"""In-app notification delivery, gated by each camper's preferences.

Only the in-app channel exists. Email and SMS rows in the preferences grid
are recorded but nothing reads them yet, because there is no sender — see
`CHANNEL`.

The gate is a pure function so the rules can be tested without a database,
and `deliver` is the thin part that reads preferences and writes rows.
"""

from __future__ import annotations

import json
import uuid
from datetime import UTC, datetime, time

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.event_summary import Notification
from app.models.profile import Profile

CHANNEL = "in_app"

#: Preference event types, matching the notification_preferences check
#: constraint and the settings grid.
EVENT_TYPES = (
    "task_assigned",
    "task_due_soon",
    "task_overdue",
    "event_created",
    "event_starting",
    "crew_announcement",
    "points_awarded",
    "level_up",
)

#: Notification `type` values mapped onto the preference rows a camper can
#: actually see in the settings grid.
#:
#: A notification type with no mapping is always delivered: the grid never
#: offered a switch for it, so nobody has chosen to turn it off, and silently
#: dropping it would lose information a camper never declined.
TYPE_TO_EVENT_TYPE: dict[str, str] = {
    "wrapped.request": "event_created",
    "wrapped.generated": "event_created",
    "wrapped.published": "event_created",
    "task.assigned": "task_assigned",
    "task.due_soon": "task_due_soon",
    "task.overdue": "task_overdue",
    "event.created": "event_created",
    "event.starting": "event_starting",
    "committee.announcement": "crew_announcement",
    "points.awarded": "points_awarded",
    "level.up": "level_up",
}

#: Event types that ignore quiet hours and the pause switch. Missing a
#: deadline is worse than a late-night notification, which is what the
#: settings page promises.
ALWAYS_DELIVERS = frozenset({"task_overdue"})


def in_quiet_hours(now: time, start: time | None, end: time | None) -> bool:
    """True when `now` falls inside the quiet window.

    A window that wraps midnight (22:00 to 07:00) is the normal case, so it
    is handled rather than treated as invalid. A window with only one end set
    is not a window at all.
    """
    if start is None or end is None:
        return False
    if start == end:
        return False
    if start < end:
        return start <= now < end
    # Wraps midnight.
    return now >= start or now < end


def should_deliver(
    *,
    event_type: str | None,
    enabled: bool,
    paused: bool,
    now: time,
    quiet_start: time | None,
    quiet_end: time | None,
) -> bool:
    """Whether one notification should be written for one camper.

    `enabled` is the camper's in-app preference for this event type, which
    defaults to True when they have never touched the switch.
    """
    # A type the settings grid never offered cannot have been declined.
    if event_type is None:
        return True

    if event_type in ALWAYS_DELIVERS:
        return True

    if paused:
        return False

    if not enabled:
        return False

    return not in_quiet_hours(now, quiet_start, quiet_end)


def _preference(db: Session, profile_id: uuid.UUID, event_type: str) -> bool:
    """The camper's in-app preference, defaulting to on when unset."""
    from sqlalchemy import text

    row = db.execute(
        text(
            "select enabled from public.notification_preferences "
            "where profile_id = :pid and event_type = :et and channel = :ch"
        ),
        {"pid": profile_id, "et": event_type, "ch": CHANNEL},
    ).scalar()
    return True if row is None else bool(row)


def deliver(
    db: Session,
    *,
    recipient_ids: list[uuid.UUID],
    type: str,
    title: str,
    body: str,
    payload: dict | None = None,
    now: datetime | None = None,
) -> int:
    """Writes a notification for each recipient who wants it.

    Returns how many were written. Recipients who have switched this event
    type off, paused everything, or are inside their quiet hours are skipped
    — nothing is queued for later, because an in-app notification the camper
    will see next time they look does not need deferring.
    """
    moment = now or datetime.now(UTC)
    event_type = TYPE_TO_EVENT_TYPE.get(type)
    written = 0

    for recipient_id in recipient_ids:
        profile = db.get(Profile, recipient_id)
        if profile is None:
            continue

        enabled = _preference(db, recipient_id, event_type) if event_type else True

        if not should_deliver(
            event_type=event_type,
            enabled=enabled,
            paused=bool(getattr(profile, "notifications_paused", False)),
            now=moment.time(),
            quiet_start=getattr(profile, "quiet_hours_start", None),
            quiet_end=getattr(profile, "quiet_hours_end", None),
        ):
            continue

        db.add(
            Notification(
                recipient_user_id=recipient_id,
                type=type,
                title=title,
                body=body,
                payload_json=json.dumps(payload) if payload else None,
            )
        )
        written += 1

    return written


def unread_count(db: Session, profile_id: uuid.UUID) -> int:
    return int(
        db.scalar(
            select(Notification)
            .where(
                Notification.recipient_user_id == profile_id,
                Notification.read_at.is_(None),
            )
            .with_only_columns(Notification.id)
            .count_by()  # type: ignore[attr-defined]
        )
        or 0
    )
