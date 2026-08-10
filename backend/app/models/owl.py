"""Per-camper owl cosmetics unlocked by an A+ grade standing."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class OwlProfile(Base):
    """Cosmetics + reward points for the campsite owl.

    Access is recomputed from weighted grade percent (A+ = 97%+).
    `access_active` caches the last result so drops can trigger notifications.
    """

    __tablename__ = "owl_profiles"

    profile_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("profiles.id", ondelete="CASCADE"), primary_key=True
    )
    points: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    belly_color: Mapped[str] = mapped_column(String, nullable=False, default="snow")
    wing_color: Mapped[str] = mapped_column(String, nullable=False, default="mist")
    accessory: Mapped[str] = mapped_column(String, nullable=False, default="none")
    trail: Mapped[str] = mapped_column(String, nullable=False, default="none")
    unlocked_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    weighted_percent: Mapped[float | None] = mapped_column(Float, nullable=True)
    access_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    access_revoked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
