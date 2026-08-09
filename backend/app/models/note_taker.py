"""Note Taker domain models: recorded meetings, transcripts, and notes."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    BigInteger,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class MeetingSession(Base):
    __tablename__ = "meeting_sessions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    created_by: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, default="recording")
    audio_storage_key: Mapped[str | None] = mapped_column(String, nullable=True)
    audio_content_type: Mapped[str | None] = mapped_column(String, nullable=True)
    audio_size_bytes: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    event_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("events.id", ondelete="SET NULL"), nullable=True
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    transcript = relationship(
        "MeetingTranscript",
        back_populates="session",
        uselist=False,
        cascade="all, delete-orphan",
    )
    note = relationship(
        "MeetingNote",
        back_populates="session",
        uselist=False,
        cascade="all, delete-orphan",
    )
    event_links = relationship(
        "MeetingSessionEventLink",
        back_populates="session",
        cascade="all, delete-orphan",
    )


class MeetingSessionEventLink(Base):
    """Places a meeting log under an event fire pit (many-to-many)."""

    __tablename__ = "meeting_session_event_links"
    __table_args__ = (
        UniqueConstraint("session_id", "event_id", name="uq_meeting_session_event"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("meeting_sessions.id", ondelete="CASCADE"), nullable=False
    )
    event_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("events.id", ondelete="CASCADE"), nullable=False
    )
    linked_by: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    session = relationship("MeetingSession", back_populates="event_links")


class MeetingTranscript(Base):
    __tablename__ = "meeting_transcripts"

    session_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("meeting_sessions.id", ondelete="CASCADE"), primary_key=True
    )
    full_text: Mapped[str] = mapped_column(Text, nullable=False, default="")
    segments_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    language: Mapped[str | None] = mapped_column(String, nullable=True)
    provider: Mapped[str] = mapped_column(String, nullable=False, default="whisper-local")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    session = relationship("MeetingSession", back_populates="transcript")


class MeetingNote(Base):
    __tablename__ = "meeting_notes"

    session_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("meeting_sessions.id", ondelete="CASCADE"), primary_key=True
    )
    title: Mapped[str] = mapped_column(String, nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    sections_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    session = relationship("MeetingSession", back_populates="note")
