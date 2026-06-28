"""
Runs router — paginates call_logs for the Pounce Runs page.
Joins lead + campaign so the frontend can show prospect name and campaign name.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select, outerjoin
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.call_log import CallLog
from app.models.lead import Lead
from app.models.campaign import Campaign

router = APIRouter(prefix="/api/runs", tags=["runs"])


def _serialize(c: CallLog, lead: Lead | None, campaign: Campaign | None) -> dict:
    duration = c.duration_seconds
    return {
        "id": str(c.id),
        "lead_id": str(c.lead_id),
        "campaign_id": str(c.campaign_id) if c.campaign_id else None,
        # Enriched display fields
        "prospect_name": lead.name if lead else None,
        "prospect_company": lead.company if lead else None,
        "campaign_name": campaign.name if campaign else None,
        "qualification_score": lead.qualification_score if lead else None,
        # Call fields
        "livekit_room_name": c.livekit_room_name,
        "status": c.status,
        "duration_seconds": duration,
        "duration_fmt": _fmt_duration(duration),
        "outcome": c.outcome,
        "meeting_link": c.meeting_link,
        "started_at": c.started_at.isoformat() if c.started_at else None,
        "ended_at": c.ended_at.isoformat() if c.ended_at else None,
        # Legacy fields expected by existing frontend types
        "created_at": c.started_at.isoformat() if c.started_at else None,
    }


def _fmt_duration(seconds: int | None) -> str:
    if seconds is None:
        return "—"
    m, s = divmod(seconds, 60)
    return f"{m}:{s:02d}"


@router.get("/")
async def list_runs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    outcome: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    base_q = (
        select(CallLog, Lead, Campaign)
        .outerjoin(Lead, CallLog.lead_id == Lead.id)
        .outerjoin(Campaign, CallLog.campaign_id == Campaign.id)
        .order_by(CallLog.started_at.desc())
    )
    if outcome:
        base_q = base_q.where(CallLog.outcome == outcome)

    count_q = select(func.count()).select_from(
        select(CallLog).where(CallLog.outcome == outcome).subquery()
        if outcome
        else CallLog
    )
    total_result = await db.execute(count_q)
    total = total_result.scalar_one()

    rows_result = await db.execute(
        base_q.offset((page - 1) * page_size).limit(page_size)
    )
    rows = rows_result.all()

    return {
        "items": [_serialize(c, lead, campaign) for c, lead, campaign in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": max(1, -(-total // page_size)),
    }


@router.get("/{session_id}")
async def get_run(session_id: str, db: AsyncSession = Depends(get_db)):
    # The runs list returns CallLog.id as the row id, so the detail lookup is
    # by id first. Fall back to livekit_room_name for older links.
    import uuid as _uuid
    cond = CallLog.livekit_room_name == session_id
    try:
        cond = CallLog.id == _uuid.UUID(session_id)
    except (ValueError, AttributeError, TypeError):
        pass
    result = await db.execute(
        select(CallLog, Lead, Campaign)
        .outerjoin(Lead, CallLog.lead_id == Lead.id)
        .outerjoin(Campaign, CallLog.campaign_id == Campaign.id)
        .where(cond)
    )
    row = result.first()
    if row is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Run not found")
    call, lead, campaign = row
    return {
        "call": _serialize(call, lead, campaign),
        "transcript": call.transcript or [],
    }
