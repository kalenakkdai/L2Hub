"""Campsite singleton settings.

`app/services/campsite.py` reaches this table through raw `text()` SQL, which
is fine for the two lifecycle statements it runs but cannot be exercised by the
test suite: conftest builds a SQLite database from `Base.metadata`, so a table
with no ORM model simply does not exist there.

The calendar feed needs to read `feed_token` on every request, and that path
has to be testable, so the singleton gets a model. Only the columns the feed
actually uses are mapped — this is deliberately not a full mirror of the table,
because a partial model that stays honest about its scope is easier to keep
correct than a wide one that drifts from the migration.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class CampsiteSettings(Base):
    __tablename__ = "campsite_settings"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    #: Pinned to a single row by a unique + check constraint in the migration.
    singleton: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    name: Mapped[str] = mapped_column(String, nullable=False, default="L2 Campsite")
    #: Bearer credential for the iCal feed. Never exposed to `authenticated`
    #: over PostgREST — the settings page reads it through an API route that
    #: checks SETTINGS_EDIT. See 20260823000000_calendar_feed.sql.
    feed_token: Mapped[str | None] = mapped_column(Text, nullable=True)
    archived_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
