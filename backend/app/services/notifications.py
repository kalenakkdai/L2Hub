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

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.models.event_summary import Notification, NotificationPreference
from app.models.profile import Profile

CHANNEL = "in_app"

#: Preference event types, matching the notification_preferences check
#: constraint.
#:
#: Not all of these are offered in the settings grid — see SOURCED_EVENT_TYPES.
EVENT_TYPES = (
    "task_assigned",
    "task_due_soon",
    "task_overdue",
    "event_created",
    "event_starting",
    "crew_announcement",
    "points_awarded",
    "level_up",
    "wrapped_activity",
    "committee_request",
    "whereabouts_ping",
)

#: The event types something in this codebase actually emits.
#:
#: The rest of EVENT_TYPES describes a product that does not exist yet: there
#: is no points ledger, so nothing can raise points_awarded or level_up, and
#: no code path creates an event or announces to a committee. A switch that
#: gates nothing is worse than a missing switch, because it tells a camper
#: they have made a choice, so the settings grid offers only these.
#:
#: task_due_soon and task_overdue stay unsourced: tasks carry a due date now,
#: but nothing sweeps them on a schedule, so no deadline notice is ever raised.
#:
#: The list is mirrored in frontend/src/hooks/useNotificationPrefs.ts. When an
#: emitter lands, both sides change together.
SOURCED_EVENT_TYPES = frozenset(
    {"wrapped_activity", "whereabouts_ping", "task_assigned", "committee_request"}
)

#: Notification `type` values mapped onto the preference rows a camper can
#: actually see in the settings grid.
#:
#: A notification type with no mapping is always delivered: the grid never
#: offered a switch for it, so nobody has chosen to turn it off, and silently
#: dropping it would lose information a camper never declined.
#:
#: The task.due_soon, task.overdue, event.* and points.* entries have no
#: emitter today. They are kept as the contract those emitters should meet,
#: not as live routing.
TYPE_TO_EVENT_TYPE: dict[str, str] = {
    # All three stages of the Wrapped lifecycle share one preference. They go
    # to the same people, about the same event, and a camper who wants one
    # wants the others.
    "wrapped.request": "wrapped_activity",
    "wrapped.generated": "wrapped_activity",
    "wrapped.published": "wrapped_activity",
    "whereabouts.ping": "whereabouts_ping",
    "task.assigned": "task_assigned",
    # Every stage of a cross-committee request shares one preference: someone
    # who wants to know they were asked also wants to know the answer.
    "request.received": "committee_request",
    "request.accepted": "committee_request",
    "request.declined": "committee_request",
    "request.completed": "committee_request",
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
    enabled = db.scalar(
        select(NotificationPreference.enabled).where(
            NotificationPreference.profile_id == profile_id,
            NotificationPreference.event_type == event_type,
            NotificationPreference.channel == CHANNEL,
        )
    )
    # No row means the camper never touched the switch, which is on.
    return True if enabled is None else bool(enabled)


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
            paused=profile.notifications_paused,
            now=moment.time(),
            quiet_start=profile.quiet_hours_start,
            quiet_end=profile.quiet_hours_end,
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

    # The session runs with autoflush off, so make the rows visible inside
    # this transaction. Committing stays the caller's decision.
    if written:
        db.flush()

    return written


def unread_count(db: Session, profile_id: uuid.UUID) -> int:
    return int(
        db.scalar(
            select(func.count())
            .select_from(Notification)
            .where(
                Notification.recipient_user_id == profile_id,
                Notification.read_at.is_(None),
            )
        )
        or 0
    )


def mark_all_read(db: Session, profile_id: uuid.UUID, *, now: datetime | None = None) -> int:
    """Marks every unread notification read. Returns how many changed."""
    result = db.execute(
        update(Notification)
        .where(
            Notification.recipient_user_id == profile_id,
            Notification.read_at.is_(None),
        )
        .values(read_at=now or datetime.now(UTC))
    )
    return result.rowcount or 0


def mark_read(
    db: Session, profile_id: uuid.UUID, notification_id: uuid.UUID, *, now: datetime | None = None
) -> int:
    """Marks one notification read, scoped to its owner."""
    result = db.execute(
        update(Notification)
        .where(
            Notification.id == notification_id,
            # Scoped to the caller so an id from elsewhere cannot be used.
            Notification.recipient_user_id == profile_id,
            Notification.read_at.is_(None),
        )
        .values(read_at=now or datetime.now(UTC))
    )
    return result.rowcount or 0
