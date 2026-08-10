"""Web push subscription storage.

One row per browser, not per camper — see 20260824000000_push_subscriptions.sql
for why `profiles` could not hold this as a column.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class PushSubscription(Base):
    __tablename__ = "push_subscriptions"
    __table_args__ = (Index("push_subscriptions_profile_id_idx", "profile_id"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    profile_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False
    )
    #: Globally unique across every browser. A re-subscribe in the same
    #: browser usually returns this same value, which is what makes the
    #: upsert-on-endpoint path work instead of accumulating duplicates.
    endpoint: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    p256dh: Mapped[str] = mapped_column(Text, nullable=False)
    auth: Mapped[str] = mapped_column(Text, nullable=False)
    #: Shown to the camper so they can tell devices apart. Never parsed.
    user_agent: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    last_used_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    profile = relationship("Profile")
