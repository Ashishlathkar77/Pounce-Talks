"""
Pounce — OutboundCallService

Architecture mirrors hevox-prod `_initiate_outbound_call`: pure LiveKit SIP
outbound. LiveKit itself dials the PSTN through its outbound trunk — there is
NO Twilio REST call and NO TwiML <Dial><Sip> inbound bridge (that bridge failed
in 0s on every answer; see commit history / Twilio logs).

Call flow:
1. Create the LiveKit room carrying lead metadata (read by the agent worker).
2. Explicitly dispatch the agent worker (agent_name=pounce) to that room.
   agent_name workers do NOT auto-pick-up rooms — without this the prospect
   answers to silence.
3. LiveKit SIP outbound (`create_sip_participant`) dials the prospect via the
   outbound trunk (ST_..., Twilio Elastic SIP → PSTN). The SIP participant
   joins the room as `sip_<E164>`; the worker waits for callStatus="active"
   before speaking so the opening line isn't lost during ringing.
"""

from __future__ import annotations

import json
import time
import uuid
from datetime import datetime, timedelta, timezone

import structlog
from livekit import api
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.call_log import CallLog
from app.models.lead import Lead

log = structlog.get_logger(__name__)


class OutboundCallService:
    """Orchestrates outbound calls via LiveKit SIP outbound (hevox-prod style)."""

    async def dispatch_call(self, lead: Lead, db: AsyncSession) -> CallLog:
        """Dial the prospect via LiveKit SIP outbound and dispatch the agent."""
        # Always dial the lead's own (editable) number — no demo override. Edit
        # a row's phone in the UI to route the call wherever you want.
        phone = (lead.phone or "").strip()
        timestamp = int(time.time())
        room_name = f"pounce-{lead.id}-{timestamp}"

        if not settings.livekit_sip_outbound_trunk_id:
            raise RuntimeError(
                "LIVEKIT_SIP_OUTBOUND_TRUNK_ID not configured — cannot place "
                "LiveKit SIP outbound call."
            )

        # Guard against placeholder / unedited numbers so we never dial junk.
        digits = phone.lstrip("+")
        if not phone.startswith("+") or not digits.isdigit() or len(digits) < 10 \
                or set(digits) == {"0"}:
            raise ValueError(
                f"Lead {lead.id} has no valid E.164 phone ({phone!r}); "
                "edit the phone field before firing the call."
            )

        log.info(
            "dispatching_call",
            lead_id=str(lead.id),
            phone=phone,
            room=room_name,
            demo_mode=settings.demo_mode,
        )

        # ── 1. Create CallLog ─────────────────────────────────────────────────
        call_log = CallLog(
            id=uuid.uuid4(),
            lead_id=lead.id,
            campaign_id=lead.campaign_id,
            livekit_room_name=room_name,
            status="initiated",
            started_at=datetime.now(timezone.utc),
        )
        db.add(call_log)
        await db.flush()

        room_metadata = json.dumps({
            "lead_id": str(lead.id),
            "name": lead.name,
            "company": lead.company,
            "phone": lead.phone,
            "role": lead.role or "",
            "call_log_id": str(call_log.id),
        })

        await db.execute(
            update(Lead)
            .where(Lead.id == lead.id)
            .values(status="calling", updated_at=datetime.now(timezone.utc))
        )
        await db.commit()

        # ── 2. LiveKit room + explicit dispatch + SIP outbound ────────────────
        lk = api.LiveKitAPI(
            url=settings.livekit_url,
            api_key=settings.livekit_api_key,
            api_secret=settings.livekit_api_secret,
        )

        try:
            # 2a. Create the room carrying lead metadata. The agent reads this
            # via ctx.room.metadata in its entrypoint.
            await lk.room.create_room(
                api.CreateRoomRequest(
                    name=room_name,
                    metadata=room_metadata,
                    empty_timeout=300,
                    max_participants=5,
                )
            )
            log.info("livekit_room_created", room=room_name)

            # 2b. Explicitly dispatch the agent worker to this room. The worker
            # registers under agent_name="pounce" and only joins rooms it was
            # dispatched to — skip this and the prospect hears silence.
            agent_name = settings.livekit_agent_name or "pounce"
            dispatch = await lk.agent_dispatch.create_dispatch(
                api.CreateAgentDispatchRequest(
                    agent_name=agent_name,
                    room=room_name,
                    metadata=room_metadata,
                )
            )
            log.info(
                "agent_dispatched",
                room=room_name,
                agent_name=agent_name,
                dispatch_id=getattr(dispatch, "id", ""),
            )

            # 2c. Dial the prospect via LiveKit SIP outbound. LiveKit places the
            # PSTN call through the outbound trunk; the SIP participant joins the
            # room as sip_<E164>. wait_until_answered=False returns immediately.
            sip_req = api.CreateSIPParticipantRequest(
                sip_trunk_id=settings.livekit_sip_outbound_trunk_id,
                sip_call_to=phone,
                room_name=room_name,
                participant_identity=f"sip_{phone.lstrip('+')}",
                participant_name=lead.name or phone,
                play_dialtone=False,
                ringing_timeout=timedelta(seconds=45),
                wait_until_answered=False,
                krisp_enabled=True,
            )
            sip_resp = await lk.sip.create_sip_participant(sip_req)
            log.info(
                "livekit_sip_dialed",
                room=room_name,
                to=phone,
                sip_call_id=getattr(sip_resp, "sip_call_id", ""),
                participant_id=getattr(sip_resp, "participant_id", ""),
                trunk=settings.livekit_sip_outbound_trunk_id,
            )

        except Exception as exc:
            log.error("dispatch_call_failed", error=str(exc), lead_id=str(lead.id))
            await db.execute(
                update(CallLog).where(CallLog.id == call_log.id).values(
                    status="failed", ended_at=datetime.now(timezone.utc)
                )
            )
            await db.execute(
                update(Lead).where(Lead.id == lead.id).values(
                    status="failed", updated_at=datetime.now(timezone.utc)
                )
            )
            await db.commit()
            raise
        finally:
            await lk.aclose()

        return call_log

    async def update_call_outcome(
        self,
        call_log_id: str,
        outcome: str,
        transcript: list[dict] | None,
        meeting_link: str | None,
        qualification_score: int | None,
        db: AsyncSession,
        agreed_meeting_time: str | None = None,
        prospect_email: str | None = None,
    ) -> None:
        result = await db.execute(
            select(CallLog).where(CallLog.id == uuid.UUID(call_log_id))
        )
        call_log = result.scalar_one_or_none()
        if not call_log:
            log.warning("update_call_outcome_not_found", call_log_id=call_log_id)
            return

        now = datetime.now(timezone.utc)
        duration = int((now - call_log.started_at).total_seconds()) if call_log.started_at else None

        call_status_map = {
            "meeting_booked": "completed",
            "qualified": "completed",
            "not_qualified": "completed",
            "no_answer": "no_answer",
            "failed": "failed",
        }
        lead_status_map = {
            "meeting_booked": "meeting_booked",
            "qualified": "qualified",
            "not_qualified": "not_qualified",
            "no_answer": "no_answer",
            "failed": "failed",
        }

        await db.execute(
            update(CallLog).where(CallLog.id == call_log.id).values(
                status=call_status_map.get(outcome, "completed"),
                outcome=outcome,
                transcript=transcript,
                meeting_link=meeting_link,
                agreed_meeting_time=agreed_meeting_time or None,
                prospect_email=prospect_email or None,
                duration_seconds=duration,
                ended_at=now,
            )
        )

        lead_values: dict = {
            "status": lead_status_map.get(outcome, "failed"),
            "updated_at": now,
        }
        if qualification_score is not None:
            lead_values["qualification_score"] = qualification_score
        if meeting_link:
            lead_values["notes"] = f"Meeting: {meeting_link}"

        await db.execute(
            update(Lead).where(Lead.id == call_log.lead_id).values(**lead_values)
        )
        await db.commit()
        log.info("call_outcome_updated", call_log_id=call_log_id, outcome=outcome, duration=duration)


# Singleton
outbound_call_service = OutboundCallService()
