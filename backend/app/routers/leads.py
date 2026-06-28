"""
Pounce — /api/leads router
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.lead import Lead

log = structlog.get_logger(__name__)
router = APIRouter(prefix="/api/leads", tags=["leads"])


# ── Schemas ───────────────────────────────────────────────────────────────────


class LeadCreate(BaseModel):
    name: str
    company: str
    phone: str
    email: str = ""
    role: str = ""
    campaign_id: uuid.UUID | None = None
    intent_source: str = "orange_slice"


class LeadBulkCreate(BaseModel):
    leads: list[LeadCreate]


class LeadUpdate(BaseModel):
    # Editable contact fields (inline-edited in the campaign leads table)
    name: str | None = None
    company: str | None = None
    phone: str | None = None
    email: str | None = None
    role: str | None = None
    # Status / qualification fields
    status: str | None = None
    qualification_score: int | None = None
    notes: str | None = None
    pain_points: list | None = None


def _lead_to_dict(lead: Lead) -> dict:
    return {
        "id": str(lead.id),
        "name": lead.name,
        "company": lead.company,
        "phone": lead.phone,
        "email": lead.email,
        "role": lead.role,
        "status": lead.status,
        "qualification_score": lead.qualification_score,
        "pain_points": lead.pain_points,
        "notes": lead.notes,
        "intent_source": lead.intent_source,
        "campaign_id": str(lead.campaign_id) if lead.campaign_id else None,
        "created_at": lead.created_at.isoformat() if lead.created_at else None,
        "updated_at": lead.updated_at.isoformat() if lead.updated_at else None,
    }


# ── Routes ────────────────────────────────────────────────────────────────────


@router.get("/")
async def list_leads(
    db: Annotated[AsyncSession, Depends(get_db)],
    campaign_id: uuid.UUID | None = Query(default=None),
    status: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
):
    """List all leads with optional filters and pagination."""
    stmt = select(Lead)
    if campaign_id:
        stmt = stmt.where(Lead.campaign_id == campaign_id)
    if status:
        stmt = stmt.where(Lead.status == status)

    stmt = stmt.order_by(Lead.created_at.desc())
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(stmt)
    leads = result.scalars().all()
    return {"leads": [_lead_to_dict(l) for l in leads], "page": page, "page_size": page_size}


@router.post("/", status_code=201)
async def create_lead(
    body: LeadCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Create a single lead."""
    lead = Lead(
        id=uuid.uuid4(),
        name=body.name,
        company=body.company,
        phone=body.phone,
        email=body.email,
        role=body.role,
        campaign_id=body.campaign_id,
        intent_source=body.intent_source,
        status="new",
    )
    db.add(lead)
    await db.commit()
    log.info("lead_created", lead_id=str(lead.id), name=lead.name)
    return _lead_to_dict(lead)


@router.post("/bulk", status_code=201)
async def bulk_create_leads(
    body: LeadBulkCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Bulk-create leads (e.g. from Orange Slice results)."""
    created = []
    for item in body.leads:
        lead = Lead(
            id=uuid.uuid4(),
            name=item.name,
            company=item.company,
            phone=item.phone,
            email=item.email,
            role=item.role,
            campaign_id=item.campaign_id,
            intent_source=item.intent_source,
            status="new",
        )
        db.add(lead)
        created.append(lead)

    await db.commit()
    log.info("leads_bulk_created", count=len(created))
    return {"created": len(created), "leads": [_lead_to_dict(l) for l in created]}


@router.get("/{lead_id}")
async def get_lead(
    lead_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get a single lead with its call logs."""
    from app.models.call_log import CallLog

    result = await db.execute(select(Lead).where(Lead.id == lead_id))
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    logs_result = await db.execute(
        select(CallLog)
        .where(CallLog.lead_id == lead_id)
        .order_by(CallLog.started_at.desc())
    )
    call_logs = logs_result.scalars().all()

    data = _lead_to_dict(lead)
    data["call_logs"] = [
        {
            "id": str(cl.id),
            "livekit_room_name": cl.livekit_room_name,
            "status": cl.status,
            "outcome": cl.outcome,
            "duration_seconds": cl.duration_seconds,
            "meeting_link": cl.meeting_link,
            "started_at": cl.started_at.isoformat() if cl.started_at else None,
            "ended_at": cl.ended_at.isoformat() if cl.ended_at else None,
        }
        for cl in call_logs
    ]
    return data


@router.patch("/{lead_id}")
async def update_lead(
    lead_id: uuid.UUID,
    body: LeadUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Update lead contact fields, status, score, or notes."""
    result = await db.execute(select(Lead).where(Lead.id == lead_id))
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    if body.name is not None:
        lead.name = body.name
    if body.company is not None:
        lead.company = body.company
    if body.phone is not None:
        lead.phone = body.phone.strip()
    if body.email is not None:
        lead.email = body.email
    if body.role is not None:
        lead.role = body.role
    if body.status is not None:
        lead.status = body.status
    if body.qualification_score is not None:
        lead.qualification_score = body.qualification_score
    if body.notes is not None:
        lead.notes = body.notes
    if body.pain_points is not None:
        lead.pain_points = body.pain_points
    lead.updated_at = datetime.now(timezone.utc)

    await db.commit()
    return _lead_to_dict(lead)
