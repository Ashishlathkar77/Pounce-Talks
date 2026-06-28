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

    # ── Tool 1: load_lead_context ─────────────────────────────────────────────

    @function_tool
    async def load_lead_context(self) -> str:
        """
        Load the lead's context at the very start of the call.
        MUST be the first tool called. Returns lead info as a summary string.
        """
        self._state.lead_loaded = True
        log.info("load_lead_context", lead_id=self._state.lead_id, name=self._state.name)
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
        log.info("qualify_lead", lead_id=self._state.lead_id, score=score, summary=summary)

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

        if not slots:
            return (
                "I wasn't able to pull up specific times right now. "
                "Let me have our team reach out to you directly to schedule. "
                "What's the best email for you?"
            )

        option_a = slots[0]["label"]
        option_b = slots[1]["label"] if len(slots) > 1 else None

        if option_b:
            return (
                f"Great, I have two slots available: Option A is {option_a}, "
                f"and Option B is {option_b}. Which works better for you?"
            )
        return f"I have {option_a} available. Does that work for you?"

    # ── Tool 5: end_call ──────────────────────────────────────────────────────

    @function_tool
    async def end_call(self, outcome: str) -> str:
        """
        End the call gracefully and update the database.
        ALWAYS call this — it is required to close out every call.
        outcome: One of qualified | not_qualified | meeting_booked | no_answer | failed
        """
        log.info("end_call", lead_id=self._state.lead_id, outcome=outcome)

        # Fire-and-forget; the shutdown fallback (_finalize_call) covers the case
        # where the caller hangs up before the agent reaches this tool.
        asyncio.create_task(_post_call_outcome(self._state, outcome))

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


# ── Cal.com slot fetcher ──────────────────────────────────────────────────────

async def _fetch_calcom_slots(preferred_time: str) -> list[dict]:
    """Fetch Cal.com slots or fall back to mock."""
    import datetime, httpx

    if not settings.calcom_api_key or not settings.calcom_event_type_id:
        log.info("calcom_not_configured_using_mock")
        return _mock_slots()

    try:
        now = datetime.datetime.now(datetime.timezone.utc)
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(
                "https://api.cal.com/v1/slots",
                params={
                    "apiKey": settings.calcom_api_key,
                    "eventTypeId": settings.calcom_event_type_id,
                    "startTime": now.isoformat(),
                    "endTime": (now + datetime.timedelta(days=7)).isoformat(),
                    "timeZone": "America/Chicago",
                },
            )
            resp.raise_for_status()
            data = resp.json()

        raw: list = []
        for times in (data.get("slots") or {}).values():
            raw.extend(times)
            if len(raw) >= 4:
                break

        if not raw:
            return _mock_slots()

        formatted = []
        for s in raw[:2]:
            start_str = s.get("time", "")
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
