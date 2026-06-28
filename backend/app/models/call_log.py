"""
CallLog model — one record per outbound call attempt to a lead.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class CallLog(Base):
    __tablename__ = "call_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # ── Foreign Keys ──────────────────────────────────────────────────────────
    lead_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("leads.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    campaign_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("campaigns.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # ── LiveKit ───────────────────────────────────────────────────────────────
    livekit_room_name: Mapped[str] = mapped_column(String(255), nullable=False)

    # ── Status ────────────────────────────────────────────────────────────────
    status: Mapped[str] = mapped_column(
        Enum(
            "initiated",
            "ringing",
            "connected",
            "completed",
            "failed",
            "no_answer",
            name="call_status",
        ),
        nullable=False,
        default="initiated",
    )

    # ── Results ───────────────────────────────────────────────────────────────
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # transcript: list of {"role": "agent"|"user", "text": str, "timestamp": str}
    transcript: Mapped[list | None] = mapped_column(JSON, nullable=True)

    outcome: Mapped[str | None] = mapped_column(
        Enum(
            "qualified",
            "not_qualified",
            "meeting_booked",
            "no_answer",
            "failed",
            name="call_outcome",
        ),
        nullable=True,
    )
    meeting_link: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Scheduled demo time (spoken label) + the email the prospect gave on the call.
    agreed_meeting_time: Mapped[str | None] = mapped_column(Text, nullable=True)
    prospect_email: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # ── Timestamps ────────────────────────────────────────────────────────────
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_now
    )
    ended_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # ── Relationships ─────────────────────────────────────────────────────────
    lead = relationship("Lead", back_populates="call_logs", lazy="noload")
    campaign = relationship("Campaign", back_populates="call_logs", lazy="noload")

    def __repr__(self) -> str:
        return (
            f"<CallLog id={self.id} lead_id={self.lead_id} status={self.status!r}>"
        )
