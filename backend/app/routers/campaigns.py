"""
Pounce — /api/campaigns router
"""

from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timezone
from typing import Annotated

import structlog
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal, get_db
from app.models.campaign import Campaign
from app.models.lead import Lead

log = structlog.get_logger(__name__)
router = APIRouter(prefix="/api/campaigns", tags=["campaigns"])


# ── Schemas ───────────────────────────────────────────────────────────────────


class CampaignCreate(BaseModel):
    name: str
    description: str = ""
    icp_description: str = ""


class CallSelectedRequest(BaseModel):
    lead_ids: list[uuid.UUID]


def _campaign_to_dict(c: Campaign) -> dict:
    return {
        "id": str(c.id),
        "name": c.name,
        "description": c.description,
        "status": c.status,
        "icp_description": c.icp_description,
        "total_targets": c.total_targets,
        "total_dialed": c.total_dialed,
        "total_qualified": c.total_qualified,
        "total_booked": c.total_booked,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
    }


# ── Routes ────────────────────────────────────────────────────────────────────


@router.get("/")
async def list_campaigns(
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
):
    stmt = (
        select(Campaign)
        .order_by(Campaign.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(stmt)
    campaigns = result.scalars().all()
    return {"campaigns": [_campaign_to_dict(c) for c in campaigns]}


@router.get("/{campaign_id}")
async def get_campaign(
    campaign_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return _campaign_to_dict(campaign)


@router.post("/", status_code=201)
async def create_campaign(
    body: CampaignCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    campaign = Campaign(
        id=uuid.uuid4(),
        name=body.name,
        description=body.description,
        icp_description=body.icp_description,
        status="draft",
    )
    db.add(campaign)
    await db.commit()
    log.info("campaign_created", campaign_id=str(campaign.id), name=campaign.name)
    return _campaign_to_dict(campaign)


@router.post("/{campaign_id}/start")
async def start_campaign(
    campaign_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Start a campaign:
    1. Set status = running
    2. Enqueue all 'new' leads in background asyncio task
    """
    result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if campaign.status not in ("draft", "paused"):
        raise HTTPException(
            status_code=400,
            detail=f"Campaign is {campaign.status}, cannot start",
        )

    campaign.status = "running"
    campaign.updated_at = datetime.now(timezone.utc)
    await db.commit()

    # Kick off background call queue (asyncio, no Celery)
    background_tasks.add_task(_process_call_queue, str(campaign_id))

    log.info("campaign_started", campaign_id=str(campaign_id))
    return {"message": "Campaign started", "campaign": _campaign_to_dict(campaign)}


@router.post("/{campaign_id}/pause")
async def pause_campaign(
    campaign_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    campaign.status = "paused"
    campaign.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return {"message": "Campaign paused", "campaign": _campaign_to_dict(campaign)}


@router.post("/{campaign_id}/cancel")
async def cancel_campaign(
    campaign_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    campaign.status = "cancelled"
    campaign.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return {"message": "Campaign cancelled", "campaign": _campaign_to_dict(campaign)}


@router.get("/{campaign_id}/leads")
async def list_campaign_leads(
    campaign_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    status: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
):
    # Verify campaign exists
    result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Campaign not found")

    stmt = select(Lead).where(Lead.campaign_id == campaign_id)
    if status:
        stmt = stmt.where(Lead.status == status)
    stmt = stmt.order_by(Lead.created_at.desc()).offset((page - 1) * page_size).limit(page_size)

    leads_result = await db.execute(stmt)
    leads = leads_result.scalars().all()

    return {
        "campaign_id": str(campaign_id),
        "leads": [
            {
                "id": str(l.id),
                "name": l.name,
                "company": l.company,
                "phone": l.phone,
                "email": l.email,
                "role": l.role,
                "status": l.status,
                "qualification_score": l.qualification_score,
                "notes": l.notes,
            }
            for l in leads
        ],
    }


@router.post("/{campaign_id}/call")
async def call_selected_leads(
    campaign_id: uuid.UUID,
    body: CallSelectedRequest,
    background_tasks: BackgroundTasks,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Fire outbound calls for a specific set of selected leads (checkbox
    selection in the UI). Each lead is dialed via LiveKit SIP outbound using
    its own (editable) phone number — no demo override. Leads with no valid
    phone are skipped server-side with an error logged.
    """
    result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    if not body.lead_ids:
        raise HTTPException(status_code=400, detail="No leads selected")

    # Only dial leads that actually belong to this campaign.
    rows = await db.execute(
        select(Lead.id).where(
            Lead.campaign_id == campaign_id,
            Lead.id.in_(body.lead_ids),
        )
    )
    valid_ids = [str(r) for r in rows.scalars().all()]
    if not valid_ids:
        raise HTTPException(status_code=404, detail="No matching leads in this campaign")

    # Mark the campaign running so the pipeline/stats reflect live activity.
    if campaign.status in ("draft", "paused"):
        campaign.status = "running"
        campaign.updated_at = datetime.now(timezone.utc)
        await db.commit()

    background_tasks.add_task(_dispatch_selected, str(campaign_id), valid_ids)
    log.info("call_selected", campaign_id=str(campaign_id), count=len(valid_ids))
    return {"dispatched": len(valid_ids), "lead_ids": valid_ids}


async def _dispatch_selected(campaign_id: str, lead_ids: list[str]) -> None:
    """Background task: dial each selected lead sequentially via LiveKit SIP."""
    from app.services.outbound_call import outbound_call_service

    campaign_uuid = uuid.UUID(campaign_id)
    for lid in lead_ids:
        async with AsyncSessionLocal() as db:
            lead = await db.get(Lead, uuid.UUID(lid))
            if not lead:
                continue
            try:
                await outbound_call_service.dispatch_call(lead, db)
                campaign = await db.get(Campaign, campaign_uuid)
                if campaign:
                    campaign.total_dialed += 1
                    campaign.updated_at = datetime.now(timezone.utc)
                    await db.commit()
            except Exception as exc:
                log.error("call_selected_dispatch_error", lead_id=lid, error=str(exc))
        await asyncio.sleep(2)

    log.info("call_selected_completed", campaign_id=campaign_id, count=len(lead_ids))


# ── Background call queue processor ──────────────────────────────────────────


async def _process_call_queue(campaign_id: str) -> None:
    """
    Background asyncio task: dispatch outbound calls for all 'new' leads
    in this campaign sequentially with a small delay between each. Each lead is
    dialed using its own (editable) phone number; leads with no valid phone are
    skipped by dispatch_call's guard. Checks campaign status before each call to
    respect pause/cancel.
    """
    from app.services.outbound_call import outbound_call_service

    log.info("call_queue_started", campaign_id=campaign_id)
    campaign_uuid = uuid.UUID(campaign_id)

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Lead)
            .where(Lead.campaign_id == campaign_uuid, Lead.status == "new")
            .order_by(Lead.created_at.asc())
        )
        leads = result.scalars().all()

    log.info("call_queue_leads_found", count=len(leads), campaign_id=campaign_id)

    for lead in leads:
        # Re-check campaign status before each call
        async with AsyncSessionLocal() as db:
            c_result = await db.execute(
                select(Campaign).where(Campaign.id == campaign_uuid)
            )
            campaign = c_result.scalar_one_or_none()
            if not campaign or campaign.status != "running":
                log.info(
                    "call_queue_halted",
                    reason=campaign.status if campaign else "not_found",
                    campaign_id=campaign_id,
                )
                return

            try:
                # Re-fetch lead inside this session
                l_result = await db.execute(
                    select(Lead).where(Lead.id == lead.id, Lead.status == "new")
                )
                fresh_lead = l_result.scalar_one_or_none()
                if not fresh_lead:
                    continue  # already called or status changed

                await outbound_call_service.dispatch_call(fresh_lead, db)

                # Increment dialed counter
                campaign.total_dialed += 1
                campaign.updated_at = datetime.now(timezone.utc)
                await db.commit()

            except Exception as exc:
                log.error(
                    "call_queue_dispatch_error",
                    lead_id=str(lead.id),
                    error=str(exc),
                )

        # Brief delay between calls to avoid SIP trunk saturation
        await asyncio.sleep(2)

    log.info("call_queue_completed", campaign_id=campaign_id)
