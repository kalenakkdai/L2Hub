"""Notify Mr. Jan to start planning three months before each ASB event.

Level-triggered like the task deadline sweep: the daily job re-reads upcoming
Activities Calendar events and raises at most one notice per event (deduped).
"""

from __future__ import annotations

import calendar
import logging
from dataclasses import dataclass
from datetime import UTC, date, datetime
from zoneinfo import ZoneInfo

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.activities_calendar_2026_2027 import ASB_PLANNING_EVENTS
from app.models.event_summary import Event
from app.services import jan, notifications
from app.services.activities_calendar_sync import _SLUG_ALIASES

logger = logging.getLogger(__name__)

PLANNING_LEAD_MONTHS = 3


@dataclass(frozen=True, slots=True)
class PlanningSweepResult:
    today: date
    considered: int = 0
    sent: int = 0
    duplicates: int = 0
    skipped: int = 0


def local_today(now: datetime | None = None) -> date:
    moment = now or datetime.now(UTC)
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=UTC)
    return moment.astimezone(ZoneInfo(settings.attendance_timezone)).date()


def months_before(day: date, months: int) -> date:
    """Calendar months before `day`, clamping the day-of-month."""
    month = day.month - months
    year = day.year
    while month <= 0:
        month += 12
        year -= 1
    last = calendar.monthrange(year, month)[1]
    return date(year, month, min(day.day, last))


def should_remind(*, event_on: date, today: date) -> bool:
    """True once we have reached the 3-month mark and the event is still ahead.

    Using an inclusive window (not only the exact day) means a missed cron run
    still delivers the reminder the next morning, while the dedupe key keeps it
    to a single notice.
    """
    if today >= event_on:
        return False
    return today >= months_before(event_on, PLANNING_LEAD_MONTHS)


def dedupe_key_for(event_id: object) -> str:
    return f"event.planning_start:{event_id}"


def _event_day(event: Event) -> date | None:
    if event.starts_at is None:
        return None
    moment = event.starts_at
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=UTC)
    return moment.astimezone(ZoneInfo(settings.attendance_timezone)).date()


def _planning_slugs() -> set[str]:
    slugs = {entry.slug for entry in ASB_PLANNING_EVENTS}
    slugs.update(_SLUG_ALIASES.values())
    slugs.update(_SLUG_ALIASES.keys())
    return slugs


def sweep_planning_reminders(
    db: Session, *, today: date | None = None
) -> PlanningSweepResult:
    """Raise Jan's start-planning notices for due ASB events."""
    on = today or local_today()
    jan_ids = jan.resolve_jan_profile_ids(db)
    if not jan_ids:
        logger.warning("planning reminder sweep found no Jan/AC recipient")
        return PlanningSweepResult(today=on)

    slugs = _planning_slugs()
    events = db.scalars(
        select(Event).where(
            Event.starts_at.is_not(None),
            Event.status != "calendar",
            or_(
                Event.slug.in_(slugs),
                Event.description.ilike("%Needs planning%"),
            ),
        )
    ).all()

    sent = duplicates = skipped = 0
    for event in events:
        event_on = _event_day(event)
        if event_on is None or not should_remind(event_on=event_on, today=on):
            skipped += 1
            continue

        pretty = f"{event_on:%B} {event_on.day}, {event_on.year}"
        result = notifications.deliver(
            db,
            recipient_ids=jan_ids,
            type="event.planning_start",
            title=f"Start planning: {event.name}",
            body=(
                f"{event.name} is on {pretty}. "
                f"Begin event planning now (about {PLANNING_LEAD_MONTHS} months out)."
            ),
            payload={
                "eventId": str(event.id),
                "slug": event.slug,
                "eventDate": event_on.isoformat(),
                "href": "/event-planning",
            },
            dedupe_key=dedupe_key_for(event.id),
            push=True,
        )
        if result.written:
            sent += result.written
        else:
            duplicates += result.duplicates or 1

    db.flush()
    return PlanningSweepResult(
        today=on,
        considered=len(events),
        sent=sent,
        duplicates=duplicates,
        skipped=skipped,
    )
