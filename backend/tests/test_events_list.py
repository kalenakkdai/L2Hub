"""Serialization of the events list that the Events page groups into blocks."""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime

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


def test_undated_events_serialize_as_null(client, make_token, seeded):
    """Undated events must not break the list; the UI falls back to status."""
    headers = auth_header(make_token, seeded["president"].id)
    events = client.get("/events", headers=headers).json()["events"]

    assert events, "expected seeded events"
    undated = [event for event in events if event["slug"].startswith("maze-day")]
    assert undated
    for event in undated:
        assert event["startsAt"] is None
        assert event["endsAt"] is None


def test_seed_promotes_enabled_fall_rally_into_events(client, make_token, seeded):
    headers = auth_header(make_token, seeded["president"].id)
    events = client.get("/events", headers=headers).json()["events"]
    rally = next(event for event in events if event["name"] == "Fall Rally")

    assert rally["eventStatus"] == "active"
    assert rally["startsAt"].startswith("2026-09-12")
    assert rally["summaryStatus"] == "not_requested"


def test_approved_plan_promotion_is_idempotent(
    client, make_token, seeded, db_session
):
    headers = auth_header(make_token, seeded["president"].id)
    payload = {
        "planId": "plan-spring-fair",
        "title": "Spring Fair 2027",
        "eventDate": date(2027, 4, 20).isoformat(),
    }

    first = client.post("/events/from-plan", headers=headers, json=payload)
    second = client.post("/events/from-plan", headers=headers, json=payload)

    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json()["id"] == second.json()["id"]
    assert first.json()["name"] == "Spring Fair"
    assert first.json()["eventStatus"] == "active"
    count = db_session.scalar(
        select(Event).where(Event.slug == first.json()["slug"])
    )
    assert count is not None


def test_member_cannot_promote_a_plan(client, make_token, seeded):
    headers = auth_header(make_token, seeded["community_member"].id)
    response = client.post(
        "/events/from-plan",
        headers=headers,
        json={
            "planId": "not-approved",
            "title": "Nope",
            "eventDate": "2027-01-01",
        },
    )
    assert response.status_code == 403