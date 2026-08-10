"""Event Summary / Wrapped domain models."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Event(Base):
    __tablename__ = "events"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String, nullable=False)
    slug: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, default="scheduled")
    managing_committee_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("committees.id", ondelete="SET NULL"), nullable=True
    )
    starts_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    #: iCal DESCRIPTION and LOCATION. Both nullable — an event that has never
    #: been given a location omits the property rather than emitting an empty
    #: one, which Google Calendar renders as a blank map pin.
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    location: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    managing_committee = relationship("Committee")
    summary = relationship(
        "EventSummary", back_populates="event", uselist=False, cascade="all, delete-orphan"
    )
    summary_requests = relationship(
        "EventSummaryRequest", back_populates="event", cascade="all, delete-orphan"
    )
    agendas = relationship("EventAgenda", back_populates="event", cascade="all, delete-orphan")
    debrief_participants = relationship(
        "DebriefParticipant", back_populates="event", cascade="all, delete-orphan"
    )


class EventSummary(Base):
    __tablename__ = "event_summaries"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    event_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("events.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    status: Mapped[str] = mapped_column(String, nullable=False, default="not_requested")
    generation_stage: Mapped[str | None] = mapped_column(String, nullable=True)
    payload_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    published_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True
    )
    # Set the first time the Wrapped is walked through with the class. The
    # per-event recap stays hidden until then.
    presented_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    presented_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    event = relationship("Event", back_populates="summary")


class EventSummaryRequest(Base):
    __tablename__ = "event_summary_requests"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    event_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("events.id", ondelete="CASCADE"), nullable=False
    )
    requested_by: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[str] = mapped_column(String, nullable=False, default="pending")
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    event = relationship("Event", back_populates="summary_requests")
    requester = relationship("Profile", foreign_keys=[requested_by])


class EventAgenda(Base):
    __tablename__ = "event_agendas"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    event_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("events.id", ondelete="CASCADE"), nullable=False
    )
    summary_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("event_summaries.id", ondelete="SET NULL"), nullable=True
    )
    content_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    status: Mapped[str] = mapped_column(String, nullable=False, default="draft")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    event = relationship("Event", back_populates="agendas")


class NotificationPreference(Base):
    """A camper's per-event-type, per-channel switch.

    A missing row means enabled: the settings grid only writes a row when
    someone changes a switch, so most campers have none at all.
    """

    __tablename__ = "notification_preferences"
    __table_args__ = (
        UniqueConstraint("profile_id", "event_type", "channel"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    profile_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False
    )
    event_type: Mapped[str] = mapped_column(String, nullable=False)
    channel: Mapped[str] = mapped_column(String, nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class Notification(Base):
    __tablename__ = "notifications"

    #: The deadline sweep is level-triggered — it re-reads every open task
    #: every morning — so without a key it would re-send the same notice
    #: daily. Both dialect predicates are spelled out so the SQLite test
    #: database enforces the rule the way Postgres does; a test that cannot
    #: fail is not a test.
    __table_args__ = (
        Index(
            "notifications_dedupe_key_uidx",
            "recipient_user_id",
            "dedupe_key",
            unique=True,
            postgresql_where=text("dedupe_key IS NOT NULL"),
            sqlite_where=text("dedupe_key IS NOT NULL"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    recipient_user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False
    )
    type: Mapped[str] = mapped_column(String, nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False, default="")
    payload_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    #: Set only by emitters that can fire repeatedly for the same thing. The
    #: row is its own receipt: a notice suppressed by quiet hours or a
    #: switched-off preference writes nothing, leaves no key, and is retried
    #: at the next milestone rather than being silently lost.
    dedupe_key: Mapped[str | None] = mapped_column(String, nullable=True)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class DebriefParticipant(Base):
    """Live / historical debrief participant bubble status."""

    __tablename__ = "debrief_participants"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    event_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("events.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True
    )
    display_name: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, default="not_started")
    # not_started | writing | submitted | absent
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    event = relationship("Event", back_populates="debrief_participants")
