"""
Campaign model — a batch of leads to dial with a shared ICP.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Campaign(Base):
    __tablename__ = "campaigns"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # ── Identity ──────────────────────────────────────────────────────────────
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    icp_description: Mapped[str] = mapped_column(Text, nullable=False, default="")

    # ── Status ────────────────────────────────────────────────────────────────
    status: Mapped[str] = mapped_column(
        Enum(
            "draft",
            "running",
            "paused",
            "completed",
            "cancelled",
            name="campaign_status",
        ),
        nullable=False,
        default="draft",
    )

    # ── Counters ──────────────────────────────────────────────────────────────
    total_targets: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_dialed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_qualified: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_booked: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # ── Timestamps ────────────────────────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_now, onupdate=_now
    )

    # ── Relationships ─────────────────────────────────────────────────────────
    leads = relationship("Lead", back_populates="campaign", lazy="noload")
    call_logs = relationship("CallLog", back_populates="campaign", lazy="noload")

    def __repr__(self) -> str:
        return f"<Campaign id={self.id} name={self.name!r} status={self.status!r}>"
