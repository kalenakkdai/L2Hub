"""Messenger Agenda: chat ingest sessions that become meeting agendas."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class MessengerAgendaSession(Base):
    """One capture window from a Messenger chat (or pasted transcript)."""

    __tablename__ = "messenger_agenda_sessions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    created_by: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String, nullable=False, default="Messenger agenda")
    status: Mapped[str] = mapped_column(String, nullable=False, default="idle")
    # paste | messenger
    source: Mapped[str] = mapped_column(String, nullable=False, default="paste")
    thread_id: Mapped[str | None] = mapped_column(String, nullable=True)
    thread_label: Mapped[str | None] = mapped_column(String, nullable=True)
    start_keyword: Mapped[str] = mapped_column(
        String, nullable=False, default="agenda start"
    )
    end_keyword: Mapped[str] = mapped_column(
        String, nullable=False, default="agenda end"
    )
    raw_text: Mapped[str] = mapped_column(Text, nullable=False, default="")
    captured_text: Mapped[str] = mapped_column(Text, nullable=False, default="")
    agenda_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    assignments_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    # JSON list of {name, color, highlight, initials, lineCount}
    contributors_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    plan_id: Mapped[str | None] = mapped_column(String, nullable=True)
    capturing_started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    finalized_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class MessengerConnection(Base):
    """Per-user Messenger grant: which chats this camper allowed L2 Hub to read."""

    __tablename__ = "messenger_connections"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    profile_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    status: Mapped[str] = mapped_column(String, nullable=False, default="disconnected")
    # JSON list of {id, label, granted}
    granted_threads_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    # Opaque page/user token when Meta Graph is configured — never returned to clients.
    access_token_enc: Mapped[str | None] = mapped_column(Text, nullable=True)
    connected_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
