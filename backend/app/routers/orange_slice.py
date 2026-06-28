"""
Pounce — /api/orange-slice router

Finds freight broker leads via Orange Slice's LinkedIn SQL API and seeds them
into the DB. In DEMO_MODE every lead's phone is replaced with DEMO_PHONE_NUMBER.
"""

from __future__ import annotations

import asyncio
import uuid
from typing import Annotated, Any

import httpx
import structlog
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.lead import Lead

log = structlog.get_logger(__name__)
router = APIRouter(prefix="/api/orange-slice", tags=["orange-slice"])

_OS_BASE = "https://enrichly-production.up.railway.app"
_POLL_TIMEOUT = 120.0   # seconds
_POLL_INTERVAL = 1.5    # seconds
_INLINE_WAIT_MS = 8000  # ask server to wait up to 8s before returning 202

# ── Freight-broker ICP SQL ─────────────────────────────────────────────────────

_FREIGHT_SQL = """
SELECT
    company_name,
    website,
    locality,
    employee_count,
    industry
FROM linkedin_company
WHERE industry IN (
    'Transportation/Trucking/Railroad',
    'Logistics & Supply Chain',
    'Package/Freight Delivery',
    'Logistics and Supply Chain'
)
  AND employee_count BETWEEN 10 AND 200
  AND company_name IS NOT NULL
  AND locality IS NOT NULL
  AND locality ILIKE '%, CA'
ORDER BY employee_count DESC
LIMIT 10
""".strip()


# ── Schemas ────────────────────────────────────────────────────────────────────


class FindLeadsRequest(BaseModel):
    icp_description: str = "freight brokers and third-party logistics companies"
    campaign_id: uuid.UUID | None = None


# ── Routes ────────────────────────────────────────────────────────────────────


@router.post("/find-leads", status_code=201)
async def find_leads(
    body: FindLeadsRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Query Orange Slice's LinkedIn database for freight broker prospects,
    seed them as Leads, and return the list (top 10).

    Phone numbers are NOT overridden — LinkedIn company data carries no phone,
    so leads come in with a blank, editable phone. Edit a row's phone in the UI
    (e.g. put your own number there) and fire the call for the selected rows.
    """
    if not settings.orange_slice_api_key:
        raise HTTPException(
            status_code=503,
            detail="ORANGE_SLICE_API_KEY not configured",
        )

    try:
        rows = await _linkedin_search(_FREIGHT_SQL)
    except Exception as exc:
        log.error("orange_slice_search_failed", error=str(exc))
        raise HTTPException(status_code=502, detail=f"Orange Slice error: {exc}") from exc

    log.info("orange_slice_rows_received", count=len(rows))

    # Phone is left as whatever the data source provides (usually blank for
    # LinkedIn company rows). It is editable in the UI — no demo override.
    created_leads: list[Lead] = []

    for i, row in enumerate(rows):
        company_name = row.get("company_name") or "Unknown"
        locality     = row.get("locality") or ""
        website      = row.get("website") or ""
        emp_count    = row.get("employee_count")
        industry     = row.get("industry") or ""

        # Normalise website — strip protocol for display but keep full URL
        website_display = (
            website.replace("https://", "").replace("http://", "").rstrip("/")
            if website else ""
        )

        # Use the real phone if the data source has one; otherwise leave blank
        # so the user can edit it inline before firing the call.
        dial_phone = (row.get("phone") or "").strip()

        lead = Lead(
            id=uuid.uuid4(),
            name=company_name,          # company name (no person name available)
            company=company_name,       # clean name without locality suffix
            phone=dial_phone,
            email=website_display,      # repurpose: show domain in email col
            role=locality,              # repurpose: show city/state in role col
            notes=str(emp_count) if emp_count is not None else None,  # employee count
            campaign_id=body.campaign_id,
            intent_source="orange_slice",
            status="new",
        )
        db.add(lead)
        created_leads.append(lead)

    if not created_leads:
        log.warning("orange_slice_no_rows", sql=_FREIGHT_SQL[:120])
        return {"created": 0, "demo_mode": settings.demo_mode, "leads": []}

    await db.commit()

    log.info(
        "orange_slice_leads_created",
        count=len(created_leads),
        campaign_id=str(body.campaign_id) if body.campaign_id else None,
        demo_mode=settings.demo_mode,
    )

    return {
        "created": len(created_leads),
        "demo_mode": settings.demo_mode,
        "leads": [
            {
                "id": str(l.id),
                "name": l.name,
                "company": l.company,
                "phone": l.phone,
                "email": l.email,       # website domain
                "role": l.role,         # locality / city-state
                "notes": l.notes,       # employee count
                "status": l.status,
                "campaign_id": str(l.campaign_id) if l.campaign_id else None,
            }
            for l in created_leads
        ],
    }


@router.get("/preview-sql")
async def preview_sql():
    """Return the ICP SQL that will be sent to Orange Slice — useful for demos."""
    return {"sql": _FREIGHT_SQL}


# ── Orange Slice HTTP client ───────────────────────────────────────────────────


async def _linkedin_search(sql: str) -> list[dict[str, Any]]:
    """
    POST /execute/sql to Orange Slice, poll if response is async (pending=true).
    Returns list of row dicts.
    """
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {settings.orange_slice_api_key}",
    }
    payload = {"sql": sql, "inlineWaitMs": _INLINE_WAIT_MS}

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            f"{_OS_BASE}/execute/sql",
            headers=headers,
            json=payload,
        )
        resp.raise_for_status()
        data: dict = resp.json()

    # Orange Slice may respond synchronously or asynchronously
    if data.get("pending"):
        data = await _poll_result(data)

    rows: list = data.get("rows") or []
    return rows


async def _poll_result(pending: dict[str, Any]) -> dict[str, Any]:
    """Poll /function/result/:requestId until complete or timeout."""
    request_id = pending.get("requestId")
    raw_poll = pending.get("pollUrl") or f"/function/result/{request_id}"
    # Orange Slice returns a relative path — always prepend base
    poll_url = raw_poll if raw_poll.startswith("http") else f"{_OS_BASE}{raw_poll}"
    poll_after = pending.get("pollAfterMs", 1500) / 1000.0

    deadline = asyncio.get_event_loop().time() + _POLL_TIMEOUT

    async with httpx.AsyncClient(timeout=20.0) as client:
        while asyncio.get_event_loop().time() < deadline:
            await asyncio.sleep(poll_after)
            resp = await client.get(poll_url)

            if resp.status_code == 202:
                try:
                    body = resp.json()
                    poll_after = body.get("pollAfterMs", _POLL_INTERVAL * 1000) / 1000.0
                except Exception:
                    pass
                continue

            resp.raise_for_status()
            data = resp.json()
            if data.get("pending"):
                poll_after = data.get("pollAfterMs", _POLL_INTERVAL * 1000) / 1000.0
                continue
            return data

    raise TimeoutError(f"Orange Slice polling timed out after {_POLL_TIMEOUT}s")
