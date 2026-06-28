"""
Pounce — CallState dataclass.

3-gate state machine:
  Gate 1: lead_loaded           → lead context available
  Gate 2: qualification_complete → score computed
  Gate 3: meeting_booked        → slot confirmed

Security: _available_slots starts with _ and is NEVER included in to_llm_context().
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class CallState:
    # ── Lead identity (from room metadata) ────────────────────────────────────
    lead_id: str
    name: str
    company: str
    phone: str
    role: str = ""

    # ── Gate flags ────────────────────────────────────────────────────────────
    lead_loaded: bool = False
    qualification_complete: bool = False
    meeting_booked: bool = False

    # ── Qualification answers ─────────────────────────────────────────────────
    q_team_size: str = ""
    q_current_process: str = ""
    q_decision_maker: str = ""
    qualification_score: int = 0

    # ── Security: NEVER passed to LLM ─────────────────────────────────────────
    # Slot objects are stored here; only their string labels go to the LLM after
    # `book_meeting` fetches them and returns them as formatted text.
    _available_slots: list = field(default_factory=list)

    # ── Tracking ──────────────────────────────────────────────────────────────
    call_log_id: str = ""
    agreed_meeting_time: str = ""
    meeting_link: str = ""

    # ── Transcript ────────────────────────────────────────────────────────────
    # Accumulated conversation turns: {"role": "user"|"assistant", "text": str,
    # "ts": float seconds since call start}. Sent to the outcome webhook on
    # end_call so the Runs tab can render the transcript.
    transcript: list = field(default_factory=list)
    # Guards against double-posting the outcome (end_call vs. shutdown fallback).
    outcome_posted: bool = False

    # ── Turn counter (for SPR re-injection) ──────────────────────────────────
    turn_count: int = 0

    def can_book_meeting(self) -> tuple[bool, str]:
        if not self.lead_loaded:
            return False, "lead context not loaded yet"
        if not self.qualification_complete:
            return False, "qualification not complete"
        if self.qualification_score < 5:
            return False, f"lead score {self.qualification_score} is below threshold (5)"
        return True, ""

    def to_llm_context(self) -> dict:
        """Return a dict safe to embed in the system prompt. _available_slots excluded."""
        return {
            "lead_name": self.name,
            "company": self.company,
            "role": self.role,
            "gates": {
                "lead_loaded": self.lead_loaded,
                "qualification_complete": self.qualification_complete,
                "meeting_booked": self.meeting_booked,
            },
            "qualification": {
                "team_size": self.q_team_size,
                "current_process": self.q_current_process,
                "decision_maker": self.q_decision_maker,
                "score": self.qualification_score,
            },
            "meeting": {
                "agreed_time": self.agreed_meeting_time,
                "link": self.meeting_link,
            },
        }
