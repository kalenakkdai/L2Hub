"""iCal subscription feed.

These run against the SQLite test database, not the shared Supabase project.
What they prove is that the RFC 5545 output and the token check behave as
intended; what they cannot prove is that the migration in
20260823000000_calendar_feed.sql applies cleanly, because that migration has
deliberately not been run anywhere.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

import pytest
from icalendar import Calendar
from sqlalchemy import select

from app.db.seed import seed_development_users
from app.models import CampsiteSettings, Committee
from app.models.event_summary import Event
from app.services import calendar_feed

TOKEN = "a" * 64
EVENT = "maze-day-2026"


@pytest.fixture
def seeded(db_session):
    return seed_development_users(db_session)


@pytest.fixture
def campsite(db_session) -> CampsiteSettings:
    row = CampsiteSettings(
        id=uuid.uuid4(), singleton=True, name="L2 Campsite", feed_token=TOKEN
    )
    db_session.add(row)
    db_session.commit()
    return row


@pytest.fixture
def scheduled_event(db_session, seeded) -> Event:
    """Exactly one dated event, so `_events(...)[0]` is unambiguous.

    The seed ships several events with real dates. Leaving them scheduled
    makes every assertion here depend on the seed's ordering, which is not
    what any of these tests are about — clearing the others means the feed
    contains one VEVENT and it is this one.
    """
    for other in db_session.scalars(select(Event)).all():
        other.starts_at = None
        other.ends_at = None

    event = db_session.execute(select(Event).where(Event.slug == EVENT)).scalar_one()
    event.starts_at = datetime(2026, 9, 18, 15, 30, tzinfo=UTC)
    event.ends_at = datetime(2026, 9, 18, 20, 0, tzinfo=UTC)
    event.description = "Bring a jacket; the quad gets cold."
    event.location = "MSJHS Quad"
    db_session.commit()
    return event


def auth_header(make_token, user_id: uuid.UUID) -> dict[str, str]:
    return {"Authorization": f"Bearer {make_token(sub=user_id)}"}


# ---------------------------------------------------------------------------
# Token check
# ---------------------------------------------------------------------------


def test_feed_without_a_token_is_refused(client, campsite):
    assert client.get("/calendar.ics").status_code == 401


def test_feed_with_a_wrong_token_is_refused(client, campsite):
    assert client.get("/calendar.ics", params={"token": "b" * 64}).status_code == 401


def test_wrong_token_and_missing_token_are_indistinguishable(client, campsite):
    """A different message for each would confirm that a token exists."""
    missing = client.get("/calendar.ics")
    wrong = client.get("/calendar.ics", params={"token": "b" * 64})
    assert missing.json() == wrong.json()


def test_feed_needs_no_bearer_token(client, campsite, scheduled_event):
    """The whole point: Google Calendar sends no Authorization header."""
    response = client.get("/calendar.ics", params={"token": TOKEN})
    assert response.status_code == 200
    assert "authorization" not in {k.lower() for k in response.request.headers}


# ---------------------------------------------------------------------------
# Response shape
# ---------------------------------------------------------------------------


def test_content_type_is_text_calendar(client, campsite, scheduled_event):
    response = client.get("/calendar.ics", params={"token": TOKEN})
    assert response.headers["content-type"].startswith("text/calendar")
    assert "charset=utf-8" in response.headers["content-type"]


def test_feed_is_not_cached_by_intermediaries(client, campsite, scheduled_event):
    """The URL carries a credential, so a shared cache must not keep a copy."""
    response = client.get("/calendar.ics", params={"token": TOKEN})
    assert "no-store" in response.headers["cache-control"]


def test_calendar_parses_and_carries_the_campsite_name(
    client, campsite, scheduled_event
):
    response = client.get("/calendar.ics", params={"token": TOKEN})
    calendar = Calendar.from_ical(response.content)

    assert calendar.get("x-wr-calname") == "L2 Campsite"
    assert calendar.get("x-wr-timezone") == "America/Los_Angeles"
    assert calendar.get("method") == "PUBLISH"
    assert calendar.get("version") == "2.0"


# ---------------------------------------------------------------------------
# VEVENT contents
# ---------------------------------------------------------------------------


def _events(body: bytes) -> list:
    return [c for c in Calendar.from_ical(body).walk() if c.name == "VEVENT"]


def test_event_carries_every_required_property(client, campsite, scheduled_event):
    body = client.get("/calendar.ics", params={"token": TOKEN}).content
    vevent = _events(body)[0]

    assert vevent.get("uid") == f"{scheduled_event.id}@l2hub.app"
    assert vevent.get("summary") == scheduled_event.name
    assert vevent.get("location") == "MSJHS Quad"
    assert vevent.get("dtstart") is not None
    assert vevent.get("dtend") is not None
    assert vevent.get("dtstamp") is not None


def test_times_are_rendered_in_pacific(client, campsite, scheduled_event):
    """15:30 UTC on 2026-09-18 is 08:30 Pacific — PDT, so UTC-7."""
    body = client.get("/calendar.ics", params={"token": TOKEN}).content
    vevent = _events(body)[0]

    start = vevent.decoded("dtstart")
    assert start.astimezone(calendar_feed.CAMPSITE_TZ).hour == 8
    assert str(start.tzinfo) == "America/Los_Angeles"


def test_uid_is_stable_across_refreshes(client, campsite, scheduled_event):
    """A changing UID makes every refresh duplicate every event."""
    first = _events(client.get("/calendar.ics", params={"token": TOKEN}).content)
    second = _events(client.get("/calendar.ics", params={"token": TOKEN}).content)
    assert first[0].get("uid") == second[0].get("uid")


def test_description_includes_the_crew_name(
    client, campsite, scheduled_event, db_session
):
    committee = db_session.scalar(select(Committee))
    scheduled_event.managing_committee_id = committee.id
    db_session.commit()

    body = client.get("/calendar.ics", params={"token": TOKEN}).content
    description = str(_events(body)[0].get("description"))

    assert "Bring a jacket" in description
    assert f"Crew: {committee.name}" in description


def test_commas_in_a_description_are_escaped(
    client, campsite, scheduled_event, db_session
):
    """RFC 5545 §3.3.11. An unescaped comma splits the value into a list."""
    scheduled_event.description = "Bring a jacket, a pen, and a friend"
    db_session.commit()

    raw = client.get("/calendar.ics", params={"token": TOKEN}).content.decode()
    assert "jacket\\, a pen\\, and a friend" in raw.replace("\r\n ", "")

    # And it survives the round trip as one value, not three.
    body = client.get("/calendar.ics", params={"token": TOKEN}).content
    assert "a pen" in str(_events(body)[0].get("description"))


def test_event_with_no_end_gets_a_default_duration(
    client, campsite, scheduled_event, db_session
):
    """DTSTART with no DTEND draws as a zero-width sliver in Google Calendar."""
    scheduled_event.ends_at = None
    db_session.commit()

    vevent = _events(client.get("/calendar.ics", params={"token": TOKEN}).content)[0]
    delta = vevent.decoded("dtend") - vevent.decoded("dtstart")
    assert delta == calendar_feed.DEFAULT_DURATION


def test_event_ending_before_it_starts_is_normalised(
    client, campsite, scheduled_event, db_session
):
    scheduled_event.ends_at = scheduled_event.starts_at
    db_session.commit()

    vevent = _events(client.get("/calendar.ics", params={"token": TOKEN}).content)[0]
    assert vevent.decoded("dtend") > vevent.decoded("dtstart")


def test_missing_location_omits_the_property(
    client, campsite, scheduled_event, db_session
):
    """An empty LOCATION renders as a blank map pin rather than nothing."""
    scheduled_event.location = None
    db_session.commit()

    vevent = _events(client.get("/calendar.ics", params={"token": TOKEN}).content)[0]
    assert vevent.get("location") is None


def test_events_without_a_start_are_omitted(client, campsite, seeded, db_session):
    """DTSTART is required by RFC 5545 and there is nothing to invent."""
    db_session.execute(select(Event))
    for event in db_session.scalars(select(Event)).all():
        event.starts_at = None
    db_session.commit()

    body = client.get("/calendar.ics", params={"token": TOKEN}).content
    assert _events(body) == []
    # Still a valid, parseable, empty calendar rather than an error.
    assert Calendar.from_ical(body).get("x-wr-calname") == "L2 Campsite"


# ---------------------------------------------------------------------------
# Per-Crew feed
# ---------------------------------------------------------------------------


def test_crew_feed_only_contains_that_crews_events(
    client, campsite, scheduled_event, db_session
):
    committees = db_session.scalars(select(Committee).order_by(Committee.name)).all()
    mine, other = committees[0], committees[1]

    scheduled_event.managing_committee_id = mine.id
    db_session.commit()

    mine_body = client.get(
        f"/committees/{mine.id}/calendar.ics", params={"token": TOKEN}
    ).content
    other_body = client.get(
        f"/committees/{other.id}/calendar.ics", params={"token": TOKEN}
    ).content

    assert len(_events(mine_body)) == 1
    assert _events(other_body) == []


def test_crew_feed_names_the_crew(client, campsite, scheduled_event, db_session):
    committee = db_session.scalar(select(Committee))
    response = client.get(
        f"/committees/{committee.id}/calendar.ics", params={"token": TOKEN}
    )
    name = Calendar.from_ical(response.content).get("x-wr-calname")
    assert committee.name in str(name)
    assert "L2 Campsite" in str(name)


def test_crew_feed_still_requires_the_token(client, campsite, db_session):
    committee = db_session.scalar(select(Committee))
    assert client.get(f"/committees/{committee.id}/calendar.ics").status_code == 401


def test_unknown_crew_is_404_not_500(client, campsite):
    response = client.get(
        f"/committees/{uuid.uuid4()}/calendar.ics", params={"token": TOKEN}
    )
    assert response.status_code == 404


# ---------------------------------------------------------------------------
# Management endpoints
# ---------------------------------------------------------------------------


def test_subscription_details_require_settings_edit(
    client, make_token, campsite, seeded
):
    """A camper must not be able to read a credential that outlives a session."""
    response = client.get(
        "/calendar/subscription",
        headers=auth_header(make_token, seeded["community_member"].id),
    )
    assert response.status_code == 403


def test_admin_can_read_the_subscription_token(client, make_token, campsite, seeded):
    response = client.get(
        "/calendar/subscription",
        headers=auth_header(make_token, seeded["president"].id),
    )
    assert response.status_code == 200
    assert response.json()["token"] == TOKEN
    assert response.json()["crews"]


def test_rotating_invalidates_the_old_url(client, make_token, campsite, seeded):
    assert client.get("/calendar.ics", params={"token": TOKEN}).status_code == 200

    rotated = client.post(
        "/calendar/subscription/rotate",
        headers=auth_header(make_token, seeded["president"].id),
    )
    new_token = rotated.json()["token"]

    assert new_token != TOKEN
    assert client.get("/calendar.ics", params={"token": TOKEN}).status_code == 401
    assert client.get("/calendar.ics", params={"token": new_token}).status_code == 200


def test_rotation_requires_settings_edit(client, make_token, campsite, seeded):
    response = client.post(
        "/calendar/subscription/rotate",
        headers=auth_header(make_token, seeded["community_member"].id),
    )
    assert response.status_code == 403


def test_generated_token_is_long_enough_to_be_unguessable():
    token = calendar_feed.generate_token()
    assert len(token) == 64
    assert calendar_feed.generate_token() != token
