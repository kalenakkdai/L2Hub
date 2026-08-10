"""Public photographer submissions — Drive links or file drops for an event."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base

# Where Leadership may use the photos. Stored as a single choice for the
# public dropdown; widen later if multi-select becomes necessary.
PHOTO_PERMISSIONS: tuple[str, ...] = (
    "instagram",
    "yearbook",
    "other",
    "instagram_and_yearbook",
)


class PhotographerSubmission(Base):
    __tablename__ = "photographer_submissions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    event_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("events.id", ondelete="CASCADE"), nullable=False
    )
    # How they want to be tagged / credited on Instagram.
    credit_name: Mapped[str] = mapped_column(String, nullable=False)
    social_media_url: Mapped[str] = mapped_column(String, nullable=False, default="")
    permission: Mapped[str] = mapped_column(String, nullable=False)
    # Optional Google Drive folder/file the photographer shared.
    drive_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Optional uploaded file — opaque key only; never the original filename.
    storage_key: Mapped[str | None] = mapped_column(String, nullable=True)
    content_type: Mapped[str | None] = mapped_column(String, nullable=True)
    size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    notes: Mapped[str] = mapped_column(Text, nullable=False, default="")
    # Soft contact name for staff follow-up (not an account).
    photographer_name: Mapped[str] = mapped_column(String, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    event = relationship("Event")
