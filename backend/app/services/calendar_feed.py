"""iCal subscription feed.

The feed is read by Google Calendar, Apple Calendar and Outlook, none of which
send an Authorization header when they refresh a subscription. Authentication
is therefore the token in the URL and nothing else — see `authenticate`.

Everything here is pure with respect to the response: the router decides status
codes and headers, this module builds the calendar. That split exists so the
RFC 5545 output can be asserted against without going through HTTP.
"""

from __future__ import annotations

import secrets
import uuid
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from icalendar import Calendar
from icalendar import Event as ICalEvent
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models import CampsiteSettings, Committee, Event

#: Every timestamp in the feed is rendered in this zone. The Campsite is a
#: single high school in California; storing UTC and displaying Pacific is the
#: whole of the timezone story here.
CAMPSITE_TZ = ZoneInfo("America/Los_Angeles")

#: Appended to each event id to form the UID. RFC 5545 wants a globally unique
#: value with domain-style scoping, and stability matters more than the domain
#: being real: change this and every subscriber's calendar duplicates every
#: event instead of updating it.
UID_DOMAIN = "l2hub.app"

#: What an event with a start but no end is assumed to last. Emitting DTSTART
#: with no DTEND is legal and means "zero duration", which Google Calendar
#: draws as an unreadable sliver.
DEFAULT_DURATION = timedelta(hours=1)

PRODID = "-//L2 Hub//The Quad//EN"


def generate_token() -> str:
    """A fresh feed token.

    Mirrors the shape the migration's default produces — 64 hex characters —
    so a token minted by the API and one minted by the database are
    indistinguishable to anything that reads them.
    """
    return secrets.token_hex(32)


def authenticate(db: Session, token: str | None) -> CampsiteSettings:
    """Resolves a feed token to the Campsite, or raises.

    Compared with `compare_digest`. The timing signal from `==` on a 64-char
    token is not realistically exploitable over the public internet, but the
    constant-time compare costs nothing and removes the need to argue about it.

    Raises `FeedAuthError` for a missing, malformed or wrong token — all three
    get the identical error so the response cannot distinguish "no such token"
    from "wrong token".
    """
    if not token:
        raise FeedAuthError

    settings_row = get_campsite(db)
    if settings_row is None or not settings_row.feed_token:
        raise FeedAuthError

    if not secrets.compare_digest(token, settings_row.feed_token):
        raise FeedAuthError

    return settings_row


class FeedAuthError(Exception):
    """Raised when a feed request carries no usable token."""


def _events_query(committee_id: uuid.UUID | None):
    query = (
        select(Event)
        .options(selectinload(Event.managing_committee))
        # An event with no start cannot become a VEVENT: DTSTART is required
        # by RFC 5545 and there is nothing sensible to invent. These are
        # dropped, and the router reports how many so the omission is visible
        # rather than silent.
        .where(Event.starts_at.is_not(None))
        .order_by(Event.starts_at)
    )
    if committee_id is not None:
        query = query.where(Event.managing_committee_id == committee_id)
    return query


def _description_for(event: Event) -> str:
    """DESCRIPTION body: the event's own text, then the Committee line.

    The Committee name is composed here rather than stored on the event, so
    renaming a Committee updates every subscriber's calendar on the next
    refresh instead of leaving the old name frozen in a text column.
    """
    parts: list[str] = []
    if event.description:
        parts.append(event.description.strip())
    if event.managing_committee is not None:
        parts.append(f"Crew: {event.managing_committee.name}")
    if event.status and event.status != "scheduled":
        parts.append(f"Status: {event.status}")
    return "\n\n".join(parts)


def _to_campsite_tz(value: datetime) -> datetime:
    """Renders an instant in Pacific time.

    A naive datetime is read as already-Pacific rather than as UTC. SQLite has
    no timezone-aware storage, so the test suite hands back naive values that
    came in as Pacific; assuming UTC here would shift every event in the tests
    by seven or eight hours depending on the season and hide real bugs.
    """
    if value.tzinfo is None:
        return value.replace(tzinfo=CAMPSITE_TZ)
    return value.astimezone(CAMPSITE_TZ)


def build_event(event: Event, *, now: datetime) -> ICalEvent:
    """One VEVENT."""
    entry = ICalEvent()

    # Stable across every refresh — derived from the row's primary key, which
    # never changes. Subscribers key off UID to decide update-vs-duplicate.
    entry.add("uid", f"{event.id}@{UID_DOMAIN}")
    entry.add("dtstamp", now)

    start = _to_campsite_tz(event.starts_at)
    entry.add("dtstart", start)

    end = (
        _to_campsite_tz(event.ends_at)
        if event.ends_at is not None
        else start + DEFAULT_DURATION
    )
    # An end at or before the start is data the calendar clients disagree about
    # — some clamp, some drop the event. Normalising here means every client
    # shows the same thing.
    if end <= start:
        end = start + DEFAULT_DURATION
    entry.add("dtend", end)

    entry.add("summary", event.name)

    description = _description_for(event)
    if description:
        entry.add("description", description)

    # Omitted rather than emitted empty: a blank LOCATION renders as an empty
    # map pin in Google Calendar.
    if event.location:
        entry.add("location", event.location.strip())

    return entry


def build_calendar(
    db: Session,
    *,
    calendar_name: str,
    committee_id: uuid.UUID | None = None,
    now: datetime | None = None,
) -> tuple[bytes, int, int]:
    """Builds the .ics body.

    Returns the encoded calendar, the number of events included, and the
    number skipped for having no start time.
    """
    stamp = now or datetime.now(tz=CAMPSITE_TZ)

    calendar = Calendar()
    calendar.add("prodid", PRODID)
    calendar.add("version", "2.0")
    calendar.add("calscale", "GREGORIAN")
    # PUBLISH marks this as a read-only feed rather than an invitation, which
    # is what stops Outlook offering Accept/Decline buttons on every event.
    calendar.add("method", "PUBLISH")
    # Non-standard, universally honoured: without X-WR-CALNAME, Google shows
    # the raw URL as the calendar's name in the sidebar.
    calendar.add("x-wr-calname", calendar_name)
    calendar.add("x-wr-timezone", str(CAMPSITE_TZ))

    events = db.scalars(_events_query(committee_id)).all()
    for event in events:
        calendar.add_component(build_event(event, now=stamp))

    skipped_query = select(func.count(Event.id)).where(Event.starts_at.is_(None))
    if committee_id is not None:
        skipped_query = skipped_query.where(Event.managing_committee_id == committee_id)
    skipped_count = db.scalar(skipped_query) or 0

    return calendar.to_ical(), len(events), skipped_count


def resolve_committee(db: Session, committee_id: uuid.UUID) -> Committee | None:
    return db.get(Committee, committee_id)


def get_campsite(db: Session) -> CampsiteSettings | None:
    """The singleton settings row, or None if the table was never seeded."""
    return db.scalar(
        select(CampsiteSettings).order_by(CampsiteSettings.created_at).limit(1)
    )


def list_committees(db: Session) -> list[Committee]:
    return list(db.scalars(select(Committee).order_by(Committee.name)).all())
