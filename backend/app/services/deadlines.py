"""The daily deadline sweep behind task_due_soon and task_overdue.

Every other notification in this codebase is edge-triggered: something
happens, and the code that made it happen raises a notice on the way past. A
deadline is not an event — nothing happens on the day a task comes due — so
this is the one emitter that has to go looking. It re-reads every open task
every morning and works out which milestone, if any, today is.

That is only safe because every notice carries a dedupe key. Without one,
a level-triggered emitter re-sends the same reminder daily until the task is
done. See `notifications.deliver`.

The sweep lives under app/services/ deliberately: tests/test_notifications.py
scans this directory for emitted `type="..."` literals and checks each one is
gated by a switch a camper can actually see. An emitter parked anywhere else
would be invisible to that guard.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.config import settings
from app.mail.protocol import EmailSender, OutgoingEmail
from app.models.work import Task
from app.services import notifications

logger = logging.getLogger(__name__)

#: How many days ahead of a due date a heads-up goes out. Both are "one
#: notice", not "a countdown" — see the module docstring on level-triggering.
MILESTONE_DAYS = (3, 1)

DUE_SOON_3 = "due_soon_3"
DUE_SOON_1 = "due_soon_1"
DUE_TODAY = "due_today"
OVERDUE = "overdue"


@dataclass(frozen=True, slots=True)
class SweepResult:
    today: date
    considered: int = 0
    due_soon_sent: int = 0
    overdue_sent: int = 0
    duplicates: int = 0
    emails_sent: int = 0
    emails_failed: int = 0


def local_today(now: datetime | None = None) -> date:
    """Today's date where the class actually is.

    `Task.due_on` is a bare date with no timezone, so "three days before" is
    meaningless until a wall clock is chosen. This picks the same one
    attendance uses, rather than letting the server's UTC clock roll the date
    over in the middle of a California afternoon.
    """
    moment = now or datetime.now(UTC)
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=UTC)
    return moment.astimezone(ZoneInfo(settings.attendance_timezone)).date()


def milestone_for(due_on: date, today: date) -> str | None:
    """Which reminder, if any, today is for a task due on `due_on`.

    Overdue is `delta < 0` rather than `delta == -1` on purpose. Paired with
    a dedupe key that carries no day, it means a task that slipped while the
    sweep was down — a deploy, a paused cron, a run of 502s — still gets its
    single notice when the sweep comes back. Matching exactly one day would
    have skipped it silently and permanently.
    """
    delta = (due_on - today).days
    if delta == 3:
        return DUE_SOON_3
    if delta == 1:
        return DUE_SOON_1
    if delta == 0:
        return DUE_TODAY
    if delta < 0:
        return OVERDUE
    return None


def dedupe_key_for(task_id: object, milestone: str) -> str:
    return f"task:{task_id}:{milestone}"


def _pretty(day: date) -> str:
    """"Friday, August 14". Avoids %-d, which is not portable off Linux."""
    return f"{day:%A, %B} {day.day}"


def _copy(task: Task, committee_name: str, milestone: str, today: date) -> tuple[str, str, str]:
    """(notification title, notification body, email subject) for a milestone."""
    when = _pretty(task.due_on)

    if milestone == OVERDUE:
        late = (today - task.due_on).days
        days = "a day" if late == 1 else f"{late} days"
        return (
            f"Overdue: {task.title}",
            f"{committee_name} — this was due {when}, {days} ago.",
            f"Overdue: {task.title}",
        )
    if milestone == DUE_TODAY:
        return (
            f"Due today: {task.title}",
            f"{committee_name} — this is due today.",
            f"Due today: {task.title}",
        )
    if milestone == DUE_SOON_1:
        return (
            f"Due tomorrow: {task.title}",
            f"{committee_name} — this is due tomorrow, {when}.",
            f"Due tomorrow: {task.title}",
        )
    return (
        f"Due in 3 days: {task.title}",
        f"{committee_name} — this is due {when}.",
        f"Due {when.split(',')[0]}: {task.title}",
    )


def _email_body(body: str) -> str:
    link = settings.app_base_url.rstrip("/")
    if not link:
        return body
    return f"{body}\n\nSee the board: {link}/board"


def sweep_deadlines(
    db: Session,
    *,
    today: date | None = None,
    now: datetime | None = None,
    sender: EmailSender | None = None,
) -> SweepResult:
    """Raise one notice per task that hits a milestone today.

    Commits per task rather than once at the end, so a failure partway
    through keeps the notices already raised. That is safe precisely because
    re-running is free: every notice is keyed, and a second pass finds the
    keys already there.
    """
    moment = now or datetime.now(UTC)
    day = today or local_today(moment)

    # The floor is not decoration. Without it the first run after a deploy
    # raises an overdue notice for every task that has ever slipped, all at
    # once, which is how a useful feature teaches everyone to mute it.
    horizon = day - timedelta(days=max(settings.deadline_backfill_days, 0))

    tasks = db.scalars(
        select(Task)
        .options(selectinload(Task.assignee), selectinload(Task.committee))
        .where(
            Task.due_on.is_not(None),
            Task.status != "done",
            Task.assignee_user_id.is_not(None),
            Task.due_on <= day + timedelta(days=max(MILESTONE_DAYS)),
            Task.due_on >= horizon,
        )
        .order_by(Task.due_on, Task.created_at)
    ).all()

    considered = 0
    due_soon_sent = 0
    overdue_sent = 0
    duplicates = 0
    emails_sent = 0
    emails_failed = 0

    for task in tasks:
        milestone = milestone_for(task.due_on, day)
        if milestone is None:
            continue

        considered += 1
        committee_name = task.committee.name if task.committee else "Your committee"
        title, body, subject = _copy(task, committee_name, milestone, day)
        key = dedupe_key_for(task.id, milestone)
        message = OutgoingEmail(to="", subject=subject, text=_email_body(body))
        payload = {"taskId": str(task.id), "committeeId": str(task.committee_id)}

        # Two literal branches rather than a lookup keyed on `milestone`.
        # The guard test in tests/test_notifications.py finds emitters by
        # scanning for `type="..."` as a string, so a computed type would
        # slip straight past it.
        if milestone == OVERDUE:
            result = notifications.deliver(
                db,
                recipient_ids=[task.assignee_user_id],
                type="task.overdue",
                title=title,
                body=body,
                payload=payload,
                now=moment,
                dedupe_key=key,
                email=message,
            )
            overdue_sent += result.written
        else:
            result = notifications.deliver(
                db,
                recipient_ids=[task.assignee_user_id],
                type="task.due_soon",
                title=title,
                body=body,
                payload=payload,
                now=moment,
                dedupe_key=key,
                email=message,
            )
            due_soon_sent += result.written

        duplicates += result.duplicates
        db.commit()

        # After the commit, never before: once a provider accepts a message
        # it cannot be recalled, so a rollback here would mean sending the
        # same reminder again tomorrow.
        sent, failed = notifications.send_pending(sender, result.pending_email)
        emails_sent += sent
        emails_failed += failed

    result = SweepResult(
        today=day,
        considered=considered,
        due_soon_sent=due_soon_sent,
        overdue_sent=overdue_sent,
        duplicates=duplicates,
        emails_sent=emails_sent,
        emails_failed=emails_failed,
    )

    log = logger.warning if emails_failed else logger.info
    log(
        "deadline sweep %s: considered=%d due_soon=%d overdue=%d duplicates=%d "
        "emails_sent=%d emails_failed=%d",
        day.isoformat(),
        considered,
        due_soon_sent,
        overdue_sent,
        duplicates,
        emails_sent,
        emails_failed,
    )
    return result
