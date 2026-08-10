"""Notification delivery, gated by each camper's preferences.

Two channels exist. In-app is the always-on one: a row in `notifications`
that the bell and the Inbox read. Email is opt-in in practice — see
`wants_email` — and best-effort, sent after the row is committed so a
provider outage costs a message rather than the notice itself.

SMS rows in the preferences grid are still recorded and still unread; there
is no SMS sender.

The gates are pure functions so the rules can be tested without a database,
and `deliver` is the thin part that reads preferences and writes rows.
"""

from __future__ import annotations

import json
import logging
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, time
from zoneinfo import ZoneInfo

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.core.config import settings
from app.mail.protocol import EmailSender, OutgoingEmail
from app.models.event_summary import Notification, NotificationPreference
from app.models.profile import Profile

logger = logging.getLogger(__name__)

CHANNEL = "in_app"
EMAIL_CHANNEL = "email"
PUSH_CHANNEL = "push"

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
#: The list is mirrored in frontend/src/hooks/useNotificationPrefs.ts. When an
#: emitter lands, both sides change together.
SOURCED_EVENT_TYPES = frozenset(
    {
        "wrapped_activity",
        "whereabouts_ping",
        "task_assigned",
        "committee_request",
        "task_due_soon",
        "task_overdue",
        # Emitted by POST /events/from-plan since web push shipped. Adding it
        # here is what puts the switch in the settings grid — without this the
        # notification would arrive with no way to turn it off.
        "event_created",
    }
)

#: Notification `type` values mapped onto the preference rows a camper can
#: actually see in the settings grid.
#:
#: A notification type with no mapping is always delivered: the grid never
#: offered a switch for it, so nobody has chosen to turn it off, and silently
#: dropping it would lose information a camper never declined.
#:
#: The event.* and points.* entries have no emitter today. They are kept as
#: the contract those emitters should meet, not as live routing.
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
#:
#: In-app only. A badge waiting on the bell at 3am costs nothing; an email
#: at 3am is a phone buzzing on a nightstand, and no deadline is worth that.
#: Email always honours the pause switch and quiet hours — see `wants_email`.
ALWAYS_DELIVERS = frozenset({"task_overdue"})


@dataclass(frozen=True, slots=True)
class DeliveryResult:
    """What one `deliver` call actually did.

    `duplicates` counts recipients skipped because they already have a
    notification with this dedupe key — the normal case for a sweep that
    re-reads the same open task every morning, not an error.

    `pending_email` is addressed and ready but deliberately unsent: `deliver`
    does not commit, and mail that goes out before the transaction lands can
    be sent a second time tomorrow if that transaction then rolls back. Hand
    it to `send_pending` after committing.
    """

    written: int = 0
    duplicates: int = 0
    pending_email: tuple[OutgoingEmail, ...] = ()
    #: Profile ids that passed the push gate, for the caller to fan out to
    #: after committing. Ids rather than addressed messages, because the
    #: devices belonging to a camper are looked up at send time — a phone that
    #: unsubscribed between the gate and the send should not be pushed to.
    pending_push: tuple[uuid.UUID, ...] = ()


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


def wants_push(
    *,
    event_type: str | None,
    push_enabled: bool,
    paused: bool,
    now: time,
    quiet_start: time | None,
    quiet_end: time | None,
) -> bool:
    """Whether this notification should also go out as a push.

    Sits between the in-app and email rules. There is no verification step to
    require — a subscription only exists because the camper granted permission
    on that device, which is a stronger signal of consent than an email switch
    that has been defaulting to on since it shipped.

    But quiet hours are honoured strictly, and `ALWAYS_DELIVERS` does not
    apply. An overdue task may light up the bell at 2am, because nothing about
    the bell wakes anyone; a push notification is a buzzing phone on a
    fifteen-year-old's nightstand, and that is exactly what quiet hours are
    for.
    """
    if event_type is None:
        return False
    if paused or not push_enabled:
        return False
    return not in_quiet_hours(now, quiet_start, quiet_end)


def wants_email(
    *,
    event_type: str | None,
    email_enabled: bool,
    email_verified: bool,
    address: str,
    paused: bool,
    now: time,
    quiet_start: time | None,
    quiet_end: time | None,
) -> bool:
    """Whether this notification should also go out as email.

    Stricter than `should_deliver` in two deliberate ways.

    The address must be verified. The settings grid has shown every email
    switch defaulting to on since it shipped, but nothing has ever sent mail,
    so "on" records a default nobody chose. Requiring a verified address means
    the first send reaches people who have proved the address is theirs,
    and everyone else keeps getting the in-app notice exactly as before.

    And `ALWAYS_DELIVERS` does not apply: overdue may light up the bell during
    quiet hours, but it may not send mail then.
    """
    if event_type is None:
        return False
    if not address or not email_verified:
        return False
    if paused or not email_enabled:
        return False
    return not in_quiet_hours(now, quiet_start, quiet_end)


def _preference(
    db: Session, profile_id: uuid.UUID, event_type: str, channel: str = CHANNEL
) -> bool:
    """The camper's preference for one event type on one channel.

    Defaults to on when unset, matching the settings grid, which only writes
    a row when someone actually changes a switch.
    """
    enabled = db.scalar(
        select(NotificationPreference.enabled).where(
            NotificationPreference.profile_id == profile_id,
            NotificationPreference.event_type == event_type,
            NotificationPreference.channel == channel,
        )
    )
    # No row means the camper never touched the switch, which is on.
    return True if enabled is None else bool(enabled)


def _already_delivered(db: Session, recipient_id: uuid.UUID, dedupe_key: str) -> bool:
    """True when this recipient already has a notification under this key."""
    existing = db.scalar(
        select(Notification.id).where(
            Notification.recipient_user_id == recipient_id,
            Notification.dedupe_key == dedupe_key,
        )
    )
    return existing is not None


def _local_time(moment: datetime) -> time:
    """`moment` as a wall-clock time in the timezone campers actually set.

    Quiet hours are entered in the settings page as local times, so comparing
    them against a UTC clock silences the wrong nine hours of the day. The
    daily deadline sweep runs at one fixed UTC instant, which would turn that
    into a permanent nightly miss for anyone whose window straddled it.
    """
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=UTC)
    return moment.astimezone(ZoneInfo(settings.attendance_timezone)).time()


def deliver(
    db: Session,
    *,
    recipient_ids: list[uuid.UUID],
    type: str,
    title: str,
    body: str,
    payload: dict | None = None,
    now: datetime | None = None,
    dedupe_key: str | None = None,
    email: OutgoingEmail | None = None,
    push: bool = False,
) -> DeliveryResult:
    """Writes a notification for each recipient who wants it.

    Recipients who have switched this event type off, paused everything, or
    are inside their quiet hours are skipped — nothing is queued for later,
    because an in-app notification the camper will see next time they look
    does not need deferring.

    `dedupe_key` makes the call idempotent per recipient, which is what lets
    a recurring sweep re-read the same task every morning without re-sending.
    Note that a suppressed notice writes no row and therefore leaves no key:
    it is retried at the next milestone rather than being recorded as sent.

    `email` carries the copy for the email channel; the recipient's own
    address is filled in per recipient. Callers own the wording, so this
    function stays routing and never grows templates. Nothing is sent here —
    the addressed messages come back on the result for the caller to send
    once it has committed.
    """
    moment = now or datetime.now(UTC)
    local_now = _local_time(moment)
    event_type = TYPE_TO_EVENT_TYPE.get(type)
    written = 0
    duplicates = 0
    pending_email: list[OutgoingEmail] = []
    pending_push: list[uuid.UUID] = []

    for recipient_id in recipient_ids:
        profile = db.get(Profile, recipient_id)
        if profile is None:
            continue

        # Checked before the preference gate: a duplicate is a duplicate
        # whatever the camper's switches say, and this is the cheaper query.
        if dedupe_key and _already_delivered(db, recipient_id, dedupe_key):
            duplicates += 1
            continue

        enabled = _preference(db, recipient_id, event_type) if event_type else True

        if not should_deliver(
            event_type=event_type,
            enabled=enabled,
            paused=profile.notifications_paused,
            now=local_now,
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
                dedupe_key=dedupe_key,
            )
        )
        written += 1

        if push:
            push_enabled = (
                _preference(db, recipient_id, event_type, PUSH_CHANNEL)
                if event_type
                else False
            )
            if wants_push(
                event_type=event_type,
                push_enabled=push_enabled,
                paused=profile.notifications_paused,
                now=local_now,
                quiet_start=profile.quiet_hours_start,
                quiet_end=profile.quiet_hours_end,
            ):
                pending_push.append(recipient_id)

        if email is not None:
            email_enabled = (
                _preference(db, recipient_id, event_type, EMAIL_CHANNEL) if event_type else False
            )
            if wants_email(
                event_type=event_type,
                email_enabled=email_enabled,
                email_verified=profile.email_verified,
                address=profile.email,
                paused=profile.notifications_paused,
                now=local_now,
                quiet_start=profile.quiet_hours_start,
                quiet_end=profile.quiet_hours_end,
            ):
                pending_email.append(
                    OutgoingEmail(
                        to=profile.email,
                        subject=email.subject,
                        text=email.text,
                        html=email.html,
                    )
                )

    # The session runs with autoflush off, so make the rows visible inside
    # this transaction. Committing stays the caller's decision.
    if written:
        db.flush()

    return DeliveryResult(
        written=written,
        duplicates=duplicates,
        pending_email=tuple(pending_email),
        pending_push=tuple(pending_push),
    )


def send_pending(
    sender: EmailSender | None, messages: tuple[OutgoingEmail, ...]
) -> tuple[int, int]:
    """Best-effort email fan-out. Returns (sent, failed).

    Call this *after* committing the notification rows: once a provider
    accepts a message it cannot be unsent, so committing first means a crash
    here costs one email rather than sending the same one twice.

    Deliberately swallows everything. A bad sender address, a provider
    outage, and an unparseable response each raise something different, and
    none of them should stop the next task in a sweep from being looked at.
    """
    if sender is None or not messages:
        return 0, 0

    sent = 0
    failed = 0
    for message in messages:
        try:
            sender.send(message)
            sent += 1
        except Exception:
            logger.exception("email delivery failed for %s", message.to)
            failed += 1
    return sent, failed


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
