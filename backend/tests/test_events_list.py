"""Serialization of the events list that the Events page groups into blocks."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

import pytest
from sqlalchemy import select

from app.db.seed import seed_development_users
from app.models.event_summary import Event

EVENT = "maze-day-2026"


@pytest.fixture
def seeded(db_session):
    return seed_development_users(db_session)


def auth_header(make_token, user_id: uuid.UUID) -> dict[str, str]:
    return {"Authorization": f"Bearer {make_token(sub=user_id)}"}


def test_events_list_exposes_the_scheduled_window(client, make_token, seeded, db_session):
    """The frontend groups by date, so both ends of the window must be sent."""
    event = db_session.execute(select(Event).where(Event.slug == EVENT)).scalar_one()
    event.starts_at = datetime(2026, 9, 18, 15, 30, tzinfo=UTC)
    event.ends_at = datetime(2026, 9, 18, 20, 0, tzinfo=UTC)
    db_session.commit()

    headers = auth_header(make_token, seeded["president"].id)
    events = client.get("/events", headers=headers).json()["events"]
    maze = next(e for e in events if e["slug"] == EVENT)

    assert maze["startsAt"].startswith("2026-09-18T15:30")
    assert maze["endsAt"].startswith("2026-09-18T20:00")


def test_events_without_a_scheduled_window_serialize_as_null(client, make_token, seeded):
    """Undated events must not break the list; the UI falls back to status."""
    headers = auth_header(make_token, seeded["president"].id)
    events = client.get("/events", headers=headers).json()["events"]

    assert events, "expected seeded events"
    for event in events:
        assert event["startsAt"] is None
        assert event["endsAt"] is None
