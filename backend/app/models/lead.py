"""
Lead model — a prospect sourced from Orange Slice or a webhook intent trigger.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Lead(Base):
    __tablename__ = "leads"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # ── Contact ───────────────────────────────────────────────────────────────
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    company: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str] = mapped_column(String(50), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    role: Mapped[str] = mapped_column(String(255), nullable=True)

    # ── Status ────────────────────────────────────────────────────────────────
    status: Mapped[str] = mapped_column(
        Enum(
            "new",
            "queued",
            "calling",
            "qualified",
            "not_qualified",
            "meeting_booked",
            "no_answer",
            "failed",
            name="lead_status",
        ),
        nullable=False,
        default="new",
    )

    # ── Qualification ─────────────────────────────────────────────────────────
    qualification_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    pain_points: Mapped[list | None] = mapped_column(JSON, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ── Source ────────────────────────────────────────────────────────────────
    intent_source: Mapped[str] = mapped_column(
        String(100), nullable=False, default="orange_slice"
    )
    lead_token: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)

    # ── Campaign FK ───────────────────────────────────────────────────────────
    campaign_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("campaigns.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # ── Timestamps ────────────────────────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_now, onupdate=_now
    )

    # ── Relationships ─────────────────────────────────────────────────────────
    campaign = relationship("Campaign", back_populates="leads", lazy="noload")
    call_logs = relationship(
        "CallLog", back_populates="lead", lazy="noload", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Lead id={self.id} name={self.name!r} status={self.status!r}>"
