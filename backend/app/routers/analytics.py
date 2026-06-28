"""
Analytics router — aggregates call_log data for the Analytics page.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.call_log import CallLog
from app.models.lead import Lead

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/dora")
async def dora_metrics(
    days: int = Query(7, ge=1, le=365),
    agent_type: str | None = Query(None),   # accepted for UI parity; single agent
    db: AsyncSession = Depends(get_db),
):
    since = datetime.now(timezone.utc) - timedelta(days=days)
    window = CallLog.started_at >= since

    total_calls = (await db.execute(
        select(func.count()).select_from(CallLog).where(window)
    )).scalar_one() or 0

    outcome_rows = await db.execute(
        select(CallLog.outcome, func.count().label("cnt"))
        .where(window).group_by(CallLog.outcome)
    )
    outcome_counts: dict[str, int] = {r.outcome: r.cnt for r in outcome_rows if r.outcome}

    booked = outcome_counts.get("meeting_booked", 0)
    qualified = outcome_counts.get("qualified", 0) + booked
    no_answer = outcome_counts.get("no_answer", 0)

    avg_dur = (await db.execute(
        select(func.avg(CallLog.duration_seconds)).where(
            window, CallLog.duration_seconds.isnot(None)
        )
    )).scalar_one() or 0
    total_dur = (await db.execute(
        select(func.sum(CallLog.duration_seconds)).where(
            window, CallLog.duration_seconds.isnot(None)
        )
    )).scalar_one() or 0

    # booking_rate is a FRACTION (0-1) — the UI multiplies by 100.
    booking_rate = round(booked / total_calls, 4) if total_calls else 0.0

    # Calls per day, zero-filled across the window so the chart never collapses.
    per_day_rows = await db.execute(
        select(
            func.date_trunc("day", CallLog.started_at).label("d"),
            func.count().label("cnt"),
        ).where(window).group_by("d")
    )
    by_day = {r.d.date().isoformat(): r.cnt for r in per_day_rows if r.d}
    today = datetime.now(timezone.utc).date()
    calls_per_day = []
    for i in range(days - 1, -1, -1):
        day = (today - timedelta(days=i)).isoformat()
        calls_per_day.append({"date": day, "count": by_day.get(day, 0)})

    return {
        "booking_rate": booking_rate,
        "avg_negotiation_attempts": 0,
        "avg_call_duration_sec": round(float(avg_dur), 1),
        "total_duration_sec": int(total_dur),
        "total_calls": total_calls,
        "total_booked": booked,
        "total_successful": qualified,
        "total_qualified": qualified,
        "calls_last_7_days": total_calls,
        "calls_last_30_days": total_calls,
        "calls_per_day": calls_per_day,
        "outcome_distribution": [
            {"outcome": k, "count": v} for k, v in outcome_counts.items()
        ],
        "funnel": _funnel([
            ("dialed",    "Dialed",    total_calls),
            ("connected", "Connected", max(0, total_calls - no_answer)),
            ("qualified", "Qualified", qualified),
            ("booked",    "Booked",    booked),
        ], total_calls),
    }


def _funnel(stages, total):
    """Build funnel rows with pct_of_total + pct_of_previous (UI expects both)."""
    out = []
    prev = None
    for key, label, count in stages:
        out.append({
            "key": key,
            "label": label,
            "stage": label,
            "count": count,
            "pct_of_total": round(count / total, 4) if total else 0.0,
            "pct_of_previous": (round(count / prev, 4) if prev else None),
        })
        prev = count
    return out


@router.get("/meetings")
async def booked_meetings(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
):
    """Every demo that got booked — with whom, when, the email, and the link."""
    since = datetime.now(timezone.utc) - timedelta(days=days)
    rows = await db.execute(
        select(CallLog, Lead)
        .outerjoin(Lead, CallLog.lead_id == Lead.id)
        .where(CallLog.outcome == "meeting_booked", CallLog.started_at >= since)
        .order_by(CallLog.started_at.desc())
    )
    meetings = []
    for call, lead in rows.all():
        meetings.append({
            "call_id": str(call.id),
            "name": lead.name if lead else None,
            "company": lead.company if lead else None,
            "email": call.prospect_email or (lead.email if lead else None),
            "meeting_time": call.agreed_meeting_time,
            "meeting_link": call.meeting_link,
            "booked_at": call.started_at.isoformat() if call.started_at else None,
            "qualification_score": lead.qualification_score if lead else None,
        })
    return {"meetings": meetings, "total": len(meetings)}
