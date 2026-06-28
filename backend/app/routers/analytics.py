"""
Analytics router — aggregates call_log data for the Analytics page.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.call_log import CallLog

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/dora")
async def dora_metrics(db: AsyncSession = Depends(get_db)):
    # Total calls
    total_result = await db.execute(select(func.count()).select_from(CallLog))
    total_calls = total_result.scalar_one() or 0

    # Outcome counts
    outcome_rows = await db.execute(
        select(CallLog.outcome, func.count().label("cnt"))
        .group_by(CallLog.outcome)
    )
    outcome_counts: dict[str, int] = {}
    for row in outcome_rows:
        if row.outcome:
            outcome_counts[row.outcome] = row.cnt

    booked = outcome_counts.get("meeting_booked", 0)
    qualified = outcome_counts.get("qualified", 0) + booked

    # Avg duration (completed calls only)
    dur_result = await db.execute(
        select(func.avg(CallLog.duration_seconds)).where(
            CallLog.duration_seconds.isnot(None)
        )
    )
    avg_dur = dur_result.scalar_one() or 0

    booking_rate = round((booked / total_calls * 100), 1) if total_calls else 0.0

    outcome_distribution = [
        {"outcome": k, "count": v} for k, v in outcome_counts.items()
    ]

    return {
        "booking_rate": booking_rate,
        "avg_negotiation_attempts": 1,
        "avg_call_duration_sec": round(avg_dur, 1),
        "total_calls": total_calls,
        "total_booked": booked,
        "total_successful": qualified,
        "calls_last_7_days": total_calls,
        "calls_last_30_days": total_calls,
        "outcome_distribution": outcome_distribution,
        "funnel": [
            {"stage": "Dialed",     "count": total_calls},
            {"stage": "Connected",  "count": max(0, total_calls - outcome_counts.get("no_answer", 0))},
            {"stage": "Qualified",  "count": qualified},
            {"stage": "Booked",     "count": booked},
        ],
    }
