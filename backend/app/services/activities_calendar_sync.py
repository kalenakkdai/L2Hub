"""Upsert the MSJ Activities Calendar into `events`.

ASB / Leadership productions become normal Events (visible on /events, feed
the iCal subscription, and qualify for Jan's three-month planning reminder).

Council, athletics, and testing rows use status=`calendar` so they appear on
the shared calendar feed without cluttering the Events / Wrapped catalog.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, time
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.activities_calendar_2026_2027 import (
    ACTIVITIES_CALENDAR_YEAR_LABEL,
    ASB_PLANNING_EVENTS,
    ActivitiesCalendarEntry,
    all_entries,
)
from app.models.event_summary import Event, EventSummary

CAMPSITE_TZ = ZoneInfo("America/Los_Angeles")

#: Stable namespace so re-syncing the same slug keeps the same event id.
_ACTIVITIES_NAMESPACE = uuid.UUID("6f2a9c1e-8b4d-4f0a-9e3c-1d7a5b8e2c44")

#: Existing seed Fall Rally uses a plan-derived slug; keep that row instead of
#: creating a duplicate when the Activities Calendar lists Fall Rally.
_SLUG_ALIASES: dict[str, str] = {
    "fall-rally-2026": "event-plan-4c7953f5fc2853429cfac21324fafd5d",
}


@dataclass(frozen=True, slots=True)
class SyncResult:
    considered: int = 0
    created: int = 0
    updated: int = 0
    planning_events: int = 0


def event_id_for(slug: str) -> uuid.UUID:
    return uuid.uuid5(_ACTIVITIES_NAMESPACE, slug)


def _lookup_slug(entry_slug: str) -> str:
    return _SLUG_ALIASES.get(entry_slug, entry_slug)


def _pacific_start(day) -> datetime:
    return datetime.combine(day, time(15, 0), tzinfo=CAMPSITE_TZ).astimezone(UTC)


def _pacific_end(day) -> datetime:
    return datetime.combine(day, time(16, 0), tzinfo=CAMPSITE_TZ).astimezone(UTC)


def _status_for(entry: ActivitiesCalendarEntry) -> str:
    if entry.category == "asb":
        return "scheduled"
    return "calendar"


def _description_for(entry: ActivitiesCalendarEntry) -> str:
    label = f"Activities Calendar {ACTIVITIES_CALENDAR_YEAR_LABEL}"
    if entry.needs_planning:
        return f"{label} · Needs planning"
    return f"{label} · {entry.category.title()}"


def _find_event(db: Session, entry: ActivitiesCalendarEntry) -> Event | None:
    slug = _lookup_slug(entry.slug)
    found = db.scalar(select(Event).where(Event.slug == slug))
    if found is not None:
        return found
    if entry.slug != slug:
        found = db.scalar(select(Event).where(Event.slug == entry.slug))
        if found is not None:
            return found
    # Name + year only for ASB productions — athletics reuse titles like
    # "AP Testing" across many days and must not collapse into one row.
    if entry.category != "asb":
        return None
    return db.scalar(
        select(Event).where(Event.name == entry.name, Event.year == entry.year)
    )


def upsert_entry(db: Session, entry: ActivitiesCalendarEntry) -> tuple[Event, bool]:
    """Returns (event, created)."""
    existing = _find_event(db, entry)
    starts = _pacific_start(entry.starts_on)
    ends = _pacific_end(entry.ends_on or entry.starts_on)
    description = _description_for(entry)
    status = _status_for(entry)

    if existing is None:
        event = Event(
            id=event_id_for(entry.slug),
            name=entry.name,
            slug=entry.slug,
            year=entry.year,
            status=status,
            starts_at=starts,
            ends_at=ends,
            description=description,
        )
        db.add(event)
        db.flush()
        if entry.needs_planning:
            db.add(EventSummary(event_id=event.id, status="not_requested"))
        return event, True

    existing.name = entry.name
    existing.year = entry.year
    existing.starts_at = starts
    existing.ends_at = ends
    existing.description = description
    # Do not downgrade an active/complete ASB event back to scheduled.
    if existing.status == "calendar" or entry.category != "asb":
        existing.status = status
    elif existing.status not in {"active", "complete"} and entry.category == "asb":
        existing.status = "scheduled"

    if entry.needs_planning:
        summary = db.scalar(
            select(EventSummary).where(EventSummary.event_id == existing.id)
        )
        if summary is None:
            db.add(EventSummary(event_id=existing.id, status="not_requested"))
    return existing, False


def sync_activities_calendar(db: Session) -> SyncResult:
    created = updated = planning = 0
    entries = all_entries()
    for entry in entries:
        _, was_created = upsert_entry(db, entry)
        if was_created:
            created += 1
        else:
            updated += 1
        if entry.needs_planning:
            planning += 1
    db.flush()
    return SyncResult(
        considered=len(entries),
        created=created,
        updated=updated,
        planning_events=planning,
    )


def planning_event_slugs() -> frozenset[str]:
    return frozenset(entry.slug for entry in ASB_PLANNING_EVENTS) | frozenset(
        _SLUG_ALIASES.values()
    )
