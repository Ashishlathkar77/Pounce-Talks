"""
Pounce — LiveKit Agents 1.6.x worker process.

Run as a separate process from FastAPI:
    python agent_worker.py dev      # dev mode (auto-reconnect)
    python agent_worker.py start    # production

This worker connects to the Claivon LiveKit cluster, listens for new rooms,
and runs the Alex SDR agent inside each room.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os

import structlog
from dotenv import load_dotenv

load_dotenv()  # must happen before any app imports

from livekit.agents import (
    Agent,
    AgentSession,
    JobContext,
    WorkerOptions,
    cli,
    function_tool,
)
from livekit.plugins import cartesia, deepgram, openai, silero

from app.agent.prompt import build_system_prompt
from app.agent.state import CallState
from app.config import settings

log = structlog.get_logger(__name__)

logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(message)s",
)


# ── Deepgram keyterm boosting for SDR calls (nova-3 uses keyterms, not keywords)
_FREIGHT_KEYTERMS = [
    "Hemut", "freight broker", "TMS", "dispatcher", "load board", "carrier",
    "brokerage", "logistics", "shipment", "capacity", "lane", "rate",
    "demo", "meeting",
]

# House voice — "Blake - Helpful Agent" (Cartesia Sonic-3), matching hevox-prod's
# inbound carrier sales II agent.
_BLAKE_VOICE_ID = "a167e0f3-df7e-4d52-a9c3-f949145efdab"


# ── Agent class ───────────────────────────────────────────────────────────────

class PounceAgent(Agent):
    """
    Alex — Pounce outbound SDR agent.
    State is stored per-instance so every call has isolated state.
    """

    def __init__(self, state: CallState):
        super().__init__(instructions=build_system_prompt(state))
        self._state = state
        self._t0: float | None = None        # set in entrypoint (call start)
        self._hangup = None                   # set in entrypoint; ends the SIP call

    def _record_tool(self, name: str, detail: str = "") -> None:
        """Append a tool-call marker to the transcript so the Runs view shows
        exactly which tool fired, when, and what it did."""
        import time as _t
        ts = round((_t.monotonic() - self._t0), 2) if self._t0 else 0.0
        self._state.transcript.append({
            "role": "tool",
            "tool": name,
            "text": f"{name}({detail})" if detail else f"{name}()",
            "ts": ts,
        })
        log.info("tool_call", tool=name, detail=detail, lead_id=self._state.lead_id)

    # ── Tool 1: load_lead_context ─────────────────────────────────────────────

    @function_tool
    async def load_lead_context(self) -> str:
        """
        Load the lead's context at the very start of the call.
        MUST be the first tool called. Returns lead info as a summary string.
        """
        self._state.lead_loaded = True
        self._record_tool("load_lead_context", self._state.name)
        return (
            f"Lead loaded — Name: {self._state.name}, "
            f"Company: {self._state.company}, "
            f"Role: {self._state.role or 'unknown'}, "
            f"Phone: {self._state.phone}. "
            f"Gate 1 (lead_loaded) is now TRUE. Proceed with the intro."
        )

    # ── Tool 2: log_qualification_answer ──────────────────────────────────────

    @function_tool
    async def log_qualification_answer(self, question: str, answer: str) -> str:
        """
        Log a qualification answer immediately after the prospect responds.
        Fire-and-forget — returns 'Got it.' instantly.
        question: One of team_size | current_process | decision_maker
        answer: Prospect's answer verbatim or a concise paraphrase
        """
        import asyncio, httpx as _httpx

        _slot_map = {
            "team_size": "q_team_size",
            "current_process": "q_current_process",
            "decision_maker": "q_decision_maker",
        }
        slot = _slot_map.get(question)
        if slot:
            setattr(self._state, slot, answer)
        else:
            log.warning("unknown_qual_question", question=question)
        self._record_tool("log_qualification_answer", f"{question}={answer[:40]}")

        async def _fire() -> None:
            try:
                async with _httpx.AsyncClient(timeout=5.0) as client:
                    await client.patch(
                        f"{settings.webhook_base_url}/api/leads/{self._state.lead_id}",
                        json={"question": question, "answer": answer},
                    )
            except Exception as exc:
                log.warning("log_answer_fire_failed", error=str(exc))

        asyncio.create_task(_fire())
        return "Got it."

    # ── Tool 3: qualify_lead ──────────────────────────────────────────────────

    @function_tool
    async def qualify_lead(self, score: int, summary: str) -> str:
        """
        Compute qualification after all 3 questions are answered.
        Sets qualification_complete gate. Requires lead_loaded first.
        score: Integer 0-10 based on the scoring rubric in the system prompt
        summary: 1-sentence summary of why the lead is or isn't a fit
        """
        if not self._state.lead_loaded:
            return "Cannot qualify: load_lead_context has not been called yet."

        self._state.qualification_score = score
        self._state.qualification_complete = True
        self._record_tool("qualify_lead", f"score={score}")

        if score >= 5:
            return (
                f"Qualified! Score: {score}/10. {summary} "
                f"Gate 2 (qualification_complete) is TRUE. Proceed to book_meeting."
            )
        return (
            f"Not qualified. Score: {score}/10. {summary} "
            f"Gate 2 TRUE. Proceed to end_call with outcome=not_qualified."
        )

    # ── Tool 4: book_meeting ──────────────────────────────────────────────────

    @function_tool
    async def book_meeting(self, preferred_time: str) -> str:
        """
        Fetch available meeting slots and return 2 options to the prospect.
        Gate-protected: requires qualification_complete AND score >= 5.
        preferred_time: e.g. 'tomorrow afternoon' or 'Monday morning'
        """
        ok, reason = self._state.can_book_meeting()
        if not ok:
            return f"Cannot book meeting: {reason}."

        slots = await _fetch_calcom_slots(preferred_time)
        self._state._available_slots = slots
        self._record_tool("book_meeting", f"prefers '{preferred_time}', {len(slots)} slots")

        if not slots:
            return (
                "I wasn't able to pull up specific times right now. "
                "What's the best email for you, and I'll have our team lock a time?"
            )

        option_a = slots[0]["label"]
        option_b = slots[1]["label"] if len(slots) > 1 else None

        if option_b:
            return (
                f"Two options: A is {option_a}, B is {option_b}. Which works better? "
                f"And what's the best email for the invite? Then I'll call confirm_meeting."
            )
        return (
            f"I've got {option_a}. Does that work? If so, what's your email and "
            f"I'll confirm it."
        )

    # ── Tool 5: confirm_meeting ───────────────────────────────────────────────

    @function_tool
    async def confirm_meeting(self, slot_choice: str, email: str) -> str:
        """
        Confirm and BOOK the demo once the prospect picks a slot and gives email.
        Creates the calendar booking and returns the confirmation.
        slot_choice: 'A' or 'B', or the spoken time they chose
        email: the prospect's email for the calendar invite
        """
        ok, reason = self._state.can_book_meeting()
        if not ok:
            return f"Cannot book meeting: {reason}."

        slots = self._state._available_slots or []
        chosen = None
        c = (slot_choice or "").strip().lower()
        if c in ("a", "option a", "first") and slots:
            chosen = slots[0]
        elif c in ("b", "option b", "second") and len(slots) > 1:
            chosen = slots[1]
        else:
            for s in slots:
                if c and c in s.get("label", "").lower():
                    chosen = s; break
        if not chosen and slots:
            chosen = slots[0]

        start = chosen.get("start") if chosen else None
        label = chosen.get("label") if chosen else "the time we discussed"

        link = await _create_calcom_booking(
            start=start, email=email, name=self._state.name, company=self._state.company,
        )

        self._state.prospect_email = email
        self._state.agreed_meeting_time = label
        self._state.meeting_link = link or ""
        self._state.meeting_booked = True
        self._record_tool("confirm_meeting", f"{label} / {email}")

        link_line = f" The invite is on its way to {email}." if link else \
                    f" Our team will email the invite to {email}."
        return (
            f"Booked you for {label}.{link_line} Anything else before I let you go? "
            f"Then call end_call with outcome=meeting_booked."
        )

    # ── Tool 6: end_call ──────────────────────────────────────────────────────

    @function_tool
    async def end_call(self, outcome: str) -> str:
        """
        End the call gracefully and update the database.
        ALWAYS call this — it is required to close out every call.
        outcome: One of qualified | not_qualified | meeting_booked | no_answer | failed
        """
        self._record_tool("end_call", f"outcome={outcome}")

        # Persist the result, then hang up the SIP line after the goodbye plays.
        asyncio.create_task(_post_call_outcome(self._state, outcome))
        if self._hangup:
            self._hangup()   # schedules the actual disconnect (see entrypoint)

        farewells = {
            "meeting_booked": (
                f"Awesome, you're all set, {self._state.name}! "
                f"You'll get a calendar invite shortly. Looking forward to chatting — have a great day!"
            ),
            "qualified": (
                f"Great talking with you, {self._state.name}. "
                f"Our team will follow up to lock in a time. Have a good one!"
            ),
            "not_qualified": (
                f"Thanks for your time, {self._state.name}. "
                f"I'll keep you in mind as we grow — take care!"
            ),
            "no_answer": "Thanks for your time. We'll be in touch. Have a great day!",
            "failed": "Thank you for your time. Goodbye.",
        }
        return farewells.get(outcome, f"Thank you, {self._state.name}. Take care!")


# ── Call outcome finalization ─────────────────────────────────────────────────

async def _post_call_outcome(state, outcome: str) -> None:
    """
    Idempotently POST the call outcome + captured transcript to the webhook.
    Called from end_call (normal path) AND from the shutdown callback (caller
    hung up before end_call). The outcome_posted flag prevents double writes.
    """
    if state.outcome_posted or not state.call_log_id:
        return
    state.outcome_posted = True

    import httpx
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            await client.post(
                f"{settings.webhook_base_url}/api/webhook/calls/{state.call_log_id}/outcome",
                json={
                    "outcome": outcome,
                    "qualification_score": state.qualification_score,
                    "q_team_size": state.q_team_size,
                    "q_current_process": state.q_current_process,
                    "q_decision_maker": state.q_decision_maker,
                    "agreed_meeting_time": state.agreed_meeting_time,
                    "meeting_link": state.meeting_link,
                    "prospect_email": state.prospect_email,
                    "transcript": state.transcript,
                },
            )
        log.info("call_outcome_posted", call_log_id=state.call_log_id,
                 outcome=outcome, turns=len(state.transcript))
    except Exception as exc:
        # Allow the shutdown fallback to retry — losing the transcript is worse
        # than a rare double POST (the webhook upsert is idempotent on call_log).
        state.outcome_posted = False
        log.warning("post_call_outcome_failed", error=str(exc), call_log_id=state.call_log_id)


def _derive_outcome(state) -> str:
    """Best-effort outcome when the call ends without an explicit end_call."""
    if state.meeting_booked:
        return "meeting_booked"
    if state.qualification_complete:
        return "qualified" if (state.qualification_score or 0) >= 5 else "not_qualified"
    if not state.transcript:
        return "no_answer"
    return "failed"


# ── Cal.com booking creator ───────────────────────────────────────────────────

async def _create_calcom_booking(start, email: str, name: str, company: str) -> str:
    """
    Create a real Cal.com booking for `start` (ISO time) with the prospect's
    email. Returns a meeting link, or "" on failure. Falls back to a placeholder
    confirmation link when Cal.com isn't configured so the demo still completes.
    """
    if not start:
        return ""
    if not settings.calcom_api_key or not settings.calcom_event_type_id:
        log.info("calcom_not_configured_booking_mock", email=email)
        return f"https://cal.com/hemut/demo?attendee={email}"

    import httpx
    payload = {
        "start": start,
        "eventTypeId": int(settings.calcom_event_type_id),
        "attendee": {
            "name": name or "Prospect",
            "email": email,
            "timeZone": "America/Chicago",
            "language": "en",
        },
        "metadata": {"source": "pounce", "company": (company or "")[:48]},
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                "https://api.cal.com/v2/bookings",
                headers={
                    "Authorization": f"Bearer {settings.calcom_api_key}",
                    "cal-api-version": "2024-08-13",
                },
                json=payload,
            )
            resp.raise_for_status()
            data = (resp.json() or {}).get("data") or {}
        uid = data.get("uid") or data.get("id")
        link = f"https://cal.com/booking/{uid}" if uid else ""
        log.info("calcom_booking_created", email=email, uid=uid)
        return link or f"https://cal.com/hemut/demo?attendee={email}"
    except Exception as exc:
        log.warning("calcom_booking_failed", error=str(exc), email=email)
        return f"https://cal.com/hemut/demo?attendee={email}"


# ── Cal.com slot fetcher ──────────────────────────────────────────────────────

async def _fetch_calcom_slots(preferred_time: str) -> list[dict]:
    """Fetch available Cal.com slots (API v2), or fall back to mock."""
    import datetime, httpx

    if not settings.calcom_api_key or not settings.calcom_event_type_id:
        log.info("calcom_not_configured_using_mock")
        return _mock_slots()

    try:
        now = datetime.datetime.now(datetime.timezone.utc)
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(
                "https://api.cal.com/v2/slots",
                headers={
                    "Authorization": f"Bearer {settings.calcom_api_key}",
                    "cal-api-version": "2024-09-04",
                },
                params={
                    "eventTypeId": settings.calcom_event_type_id,
                    "start": now.date().isoformat(),
                    "end": (now + datetime.timedelta(days=7)).date().isoformat(),
                    "timeZone": "America/Chicago",
                },
            )
            resp.raise_for_status()
            data = (resp.json() or {}).get("data") or {}

        # data is { "YYYY-MM-DD": [ {"start": "ISO"} , ... ], ... }
        raw: list[str] = []
        for day in sorted(data.keys()):
            for slot in data[day]:
                s = slot.get("start") if isinstance(slot, dict) else slot
                if s:
                    raw.append(s)
            if len(raw) >= 4:
                break

        if not raw:
            return _mock_slots()

        formatted = []
        for start_str in raw[:2]:
            try:
                dt = datetime.datetime.fromisoformat(start_str.replace("Z", "+00:00"))
                label = dt.strftime("%A, %B %-d at %-I:%M %p CT")
            except Exception:
                label = start_str
            formatted.append({"label": label, "start": start_str, "slot_id": start_str})
        return formatted
    except Exception as exc:
        log.warning("calcom_fetch_failed", error=str(exc))
        return _mock_slots()


def _mock_slots() -> list[dict]:
    import datetime
    now = datetime.datetime.now(datetime.timezone.utc)
    slot_a = now + datetime.timedelta(days=1, hours=10)
    slot_b = now + datetime.timedelta(days=2, hours=14)
    return [
        {"label": slot_a.strftime("%A, %B %-d at %-I:%M %p CT"), "start": slot_a.isoformat(), "slot_id": slot_a.isoformat()},
        {"label": slot_b.strftime("%A, %B %-d at %-I:%M %p CT"), "start": slot_b.isoformat(), "slot_id": slot_b.isoformat()},
    ]


# ── Continuous call-center background ambience ────────────────────────────────

async def _play_continuous_bg(room, control: dict) -> None:
    """
    Publish a looping call-center ambience track (matches hevox-prod). Runs as
    its own LiveKit audio track — always on, independent of TTS — so the call
    sounds like it's coming from a live sales floor. `control` is shared so the
    track can be unpublished and the loop cancelled on shutdown.
    """
    import wave
    from pathlib import Path

    import numpy as np
    from livekit import rtc

    bg_path = Path(__file__).parent / "assets" / "call-center-bg.wav"
    if not bg_path.exists():
        log.warning("agent.no_bg_audio_file", path=str(bg_path))
        return

    with wave.open(str(bg_path), "rb") as wf:
        src_rate = wf.getframerate()
        frames = wf.readframes(wf.getnframes())
        samples = np.frombuffer(frames, dtype=np.int16)

    # Resample to 24kHz to match TTS output rate (SIP bridge mixes all tracks).
    target_rate = 24000
    if src_rate != target_rate:
        ratio = target_rate / src_rate
        new_len = int(len(samples) * ratio)
        indices = np.clip((np.arange(new_len) / ratio).astype(int), 0, len(samples) - 1)
        samples = samples[indices]

    # Volume — clearly audible call-center hum without masking the agent.
    volume = 0.3
    samples = (samples.astype(np.float32) * volume).astype(np.int16)

    audio_source = rtc.AudioSource(target_rate, 1)
    track = rtc.LocalAudioTrack.create_audio_track("bg-audio", audio_source)
    await room.local_participant.publish_track(track, rtc.TrackPublishOptions())
    control["track"] = track
    log.info("agent.bg_track_published", samples=len(samples))

    chunk_duration = 0.04
    chunk_samples = int(target_rate * chunk_duration)
    pos, total = 0, len(samples)
    try:
        while True:
            end = pos + chunk_samples
            if end > total:
                chunk = np.concatenate([samples[pos:], samples[:end - total]])
                pos = end - total
            else:
                chunk = samples[pos:end]
                pos = end
            await audio_source.capture_frame(rtc.AudioFrame(
                data=chunk.tobytes(),
                sample_rate=target_rate,
                num_channels=1,
                samples_per_channel=chunk_samples,
            ))
            await asyncio.sleep(chunk_duration * 0.9)
    except asyncio.CancelledError:
        log.info("agent.bg_track_loop_cancelled")
        raise


# ── Worker entrypoint ─────────────────────────────────────────────────────────

async def entrypoint(ctx: JobContext) -> None:
    """Called by the LiveKit worker for every new room/job."""
    await ctx.connect()

    raw_metadata = ctx.room.metadata or "{}"
    try:
        metadata = json.loads(raw_metadata)
    except json.JSONDecodeError:
        log.error("agent_metadata_parse_error", raw=raw_metadata)
        metadata = {}

    state = CallState(
        lead_id=metadata.get("lead_id", "unknown"),
        name=metadata.get("name", "there"),
        company=metadata.get("company", "your company"),
        phone=metadata.get("phone", ""),
        role=metadata.get("role", ""),
        call_log_id=metadata.get("call_log_id", ""),
    )

    log.info("agent_started", room=ctx.room.name, lead_id=state.lead_id, name=state.name)

    # ── Wait for the prospect to actually answer (SIP outbound) ───────────────
    # LiveKit SIP outbound adds the prospect as a participant while the call is
    # still ringing; its `sip.callStatus` attribute flips to "active" on answer.
    # Speaking before that loses the opening line during ringing (hevox-prod
    # waits the same way). Falls through after a timeout so a missing attribute
    # never wedges the call.
    async def _wait_for_answer(timeout: float = 50.0) -> None:
        import asyncio

        def _answered() -> bool:
            for p in ctx.room.remote_participants.values():
                status = (p.attributes or {}).get("sip.callStatus")
                if status == "active":
                    return True
            return False

        if _answered():
            return
        answered_evt = asyncio.Event()

        def _on_attrs_changed(_changed, participant) -> None:
            if (participant.attributes or {}).get("sip.callStatus") == "active":
                answered_evt.set()

        def _on_connected(participant) -> None:
            if (participant.attributes or {}).get("sip.callStatus") == "active":
                answered_evt.set()

        ctx.room.on("participant_attributes_changed", _on_attrs_changed)
        ctx.room.on("participant_connected", _on_connected)
        try:
            await asyncio.wait_for(answered_evt.wait(), timeout=timeout)
            log.info("sip_call_active", room=ctx.room.name)
        except asyncio.TimeoutError:
            log.warning("sip_answer_wait_timeout", room=ctx.room.name)
        finally:
            ctx.room.off("participant_attributes_changed", _on_attrs_changed)
            ctx.room.off("participant_connected", _on_connected)

    await _wait_for_answer()

    try:
        from livekit.plugins.turn_detector.multilingual import MultilingualModel
        turn_detector = MultilingualModel()
    except Exception:
        turn_detector = None

    # Agent pipeline mirrors hevox-prod's inbound carrier sales II agent:
    #   STT  = Deepgram nova-3 (en) with freight keyterm boosting
    #   LLM  = OpenAI gpt-4.1 @ temp 0.3 (reliable tool calls, natural cadence)
    #   TTS  = Cartesia Sonic-3, "Blake - Helpful Agent" voice, broker-tuned
    session_kwargs = dict(
        stt=deepgram.STT(
            model="nova-3",
            language="en",
            keyterm=_FREIGHT_KEYTERMS,
            api_key=settings.deepgram_api_key,
        ),
        llm=openai.LLM(
            model="gpt-4.1",
            temperature=0.3,
            api_key=settings.openai_api_key,
        ),
        tts=cartesia.TTS(
            model="sonic-3",
            voice=_BLAKE_VOICE_ID,
            language=None,          # auto-detect from LLM text
            speed=0.96,             # slight drag = natural phone cadence
            emotion=["positivity:low"],
            text_pacing=True,       # keep Cartesia's natural phrase pauses
            api_key=settings.cartesia_api_key,
        ),
        vad=silero.VAD.load(),
        user_away_timeout=5.0,
        turn_handling={
            "interruption": {
                "min_duration": 0.5,
                "min_words": 2,
                "false_interruption_timeout": 2.0,
                "resume_false_interruption": True,
            },
            "preemptive_generation": {"enabled": False},
        },
    )
    if turn_detector:
        session_kwargs["turn_detection"] = turn_detector

    session = AgentSession(**session_kwargs)
    agent = PounceAgent(state)

    # ── Capture the transcript ────────────────────────────────────────────────
    # Append every finalized user/assistant turn to state.transcript so end_call
    # can ship it to the outcome webhook → Runs tab. ts = seconds since start.
    import time as _time
    _call_t0 = _time.monotonic()
    agent._t0 = _call_t0   # tool-call markers share the same clock

    # ── Hang up the SIP line when end_call fires ──────────────────────────────
    # Give the goodbye line time to play, then delete the room (drops the PSTN
    # leg + the agent) so the call actually ends.
    def _hangup() -> None:
        async def _go() -> None:
            await asyncio.sleep(7.0)  # let the farewell finish speaking
            try:
                from livekit import api as _lkapi
                lk = _lkapi.LiveKitAPI(
                    url=settings.livekit_url,
                    api_key=settings.livekit_api_key,
                    api_secret=settings.livekit_api_secret,
                )
                try:
                    await lk.room.delete_room(_lkapi.DeleteRoomRequest(room=ctx.room.name))
                    log.info("call_hung_up", room=ctx.room.name)
                finally:
                    await lk.aclose()
            except Exception as exc:
                log.warning("hangup_failed", error=str(exc))
        asyncio.create_task(_go())

    agent._hangup = _hangup

    def _on_conversation_item(ev) -> None:
        try:
            item = getattr(ev, "item", None)
            if item is None:
                return
            role = getattr(item, "role", None)
            text = (getattr(item, "text_content", None) or "").strip()
            if role not in ("user", "assistant") or not text:
                return
            state.transcript.append({
                "role": role,
                "text": text,
                "ts": round(_time.monotonic() - _call_t0, 2),
            })
        except Exception as exc:  # never let transcript capture break the call
            log.debug("transcript_capture_failed", error=str(exc))

    session.on("conversation_item_added", _on_conversation_item)

    await session.start(agent, room=ctx.room)

    # Continuous call-center ambience — separate track, always on (hevox parity).
    bg_audio_state: dict = {"task": None, "track": None}
    bg_audio_state["task"] = asyncio.create_task(_play_continuous_bg(ctx.room, bg_audio_state))

    async def _stop_bg_audio() -> None:
        task = bg_audio_state.pop("task", None)
        track = bg_audio_state.pop("track", None)
        if task:
            task.cancel()
            try:
                await task
            except (Exception, asyncio.CancelledError):
                pass
        if track:
            try:
                await ctx.room.local_participant.unpublish_track(track.sid)
            except Exception as exc:
                log.debug("agent.bg_unpublish_failed", error=str(exc))
        log.info("agent.bg_audio_stopped")

    ctx.add_shutdown_callback(_stop_bg_audio)

    # Fallback finalizer — if the caller hangs up before the agent calls
    # end_call, still persist the transcript + a derived outcome to the Runs tab.
    async def _finalize_call() -> None:
        if state.outcome_posted:
            return
        await _post_call_outcome(state, _derive_outcome(state))

    ctx.add_shutdown_callback(_finalize_call)

    session.generate_reply(
        instructions="Call load_lead_context() immediately, then deliver the intro script."
    )

    log.info("agent_session_started", room=ctx.room.name, lead_id=state.lead_id)


if __name__ == "__main__":
    # Explicit-dispatch mode (hevox-prod style). The worker registers under
    # agent_name="pounce" and only runs in rooms it was explicitly dispatched to
    # via agent_dispatch.create_dispatch (see OutboundCallService.dispatch_call).
    # This pairs with LiveKit SIP outbound — no auto-dispatch, no Twilio bridge.
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            agent_name=settings.livekit_agent_name or "pounce",
        )
    )
