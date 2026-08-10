"""The daily deadline sweep.

The sweep is the only level-triggered emitter in the app: it re-reads every
open task every morning rather than reacting to something happening. Most of
what is worth testing follows from that — it must not repeat itself, and it
must not record a notice it did not actually send.
"""

from __future__ import annotations

from datetime import UTC, date, datetime, time, timedelta

import pytest
from sqlalchemy import select

from app.db.seed import SEED_COMMITTEE_IDS, seed_development_users
from app.mail.protocol import OutgoingEmail, SentEmail
from app.models import Notification
from app.models.event_summary import NotificationPreference
from app.models.work import Task
from app.services import deadlines

COMMUNITY = SEED_COMMITTEE_IDS["community"]
SPIRIT = SEED_COMMITTEE_IDS["spirit"]

TODAY = date(2026, 8, 12)


@pytest.fixture
def seeded(db_session):
    return seed_development_users(db_session)


class RecordingSender:
    """Captures messages instead of sending them."""

    def __init__(self) -> None:
        self.sent: list[OutgoingEmail] = []

    def send(self, message: OutgoingEmail) -> SentEmail:
        self.sent.append(message)
        return SentEmail(provider_id="rec_1", accepted=True)


class BrokenSender:
    def send(self, message: OutgoingEmail) -> SentEmail:
        raise RuntimeError("provider is down")


def make_task(db_session, seeded, *, due_on, status="todo", assignee="community_member", title="Book the venue"):
    task = Task(
        committee_id=COMMUNITY,
        title=title,
        details="",
        status=status,
        assignee_user_id=seeded[assignee].id if assignee else None,
        due_on=due_on,
    )
    db_session.add(task)
    db_session.commit()
    return task


def notices(db_session, recipient_id) -> list[Notification]:
    return list(
        db_session.scalars(
            select(Notification)
            .where(Notification.recipient_user_id == recipient_id)
            .order_by(Notification.created_at)
        ).all()
    )


# ---------------------------------------------------------------------------
# Which day is which milestone — pure, no database
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("offset", "expected"),
    [
        (10, None),
        (5, None),
        (4, None),
        (3, deadlines.DUE_SOON_3),
        (2, None),
        (1, deadlines.DUE_SOON_1),
        (0, deadlines.DUE_TODAY),
        (-1, deadlines.OVERDUE),
        (-30, deadlines.OVERDUE),
    ],
)
def test_each_distance_from_the_due_date_has_one_meaning(offset, expected):
    assert milestone(offset) == expected


def milestone(offset: int) -> str | None:
    return deadlines.milestone_for(TODAY + timedelta(days=offset), TODAY)


def test_two_days_out_is_deliberately_quiet():
    """Four notices is a cadence; five is nagging, and nagging gets muted."""
    assert milestone(2) is None
    assert milestone(4) is None


def test_anything_already_late_is_overdue_not_just_yesterday():
    """A sweep that was down for a week must still notice what slipped.

    Matching exactly one day past due would skip those tasks silently and
    permanently, which is the failure nobody would ever see reported.
    """
    assert milestone(-1) == deadlines.OVERDUE
    assert milestone(-7) == deadlines.OVERDUE


# ---------------------------------------------------------------------------
# The sweep
# ---------------------------------------------------------------------------


def test_tells_the_assignee_three_days_out(db_session, seeded):
    make_task(db_session, seeded, due_on=TODAY + timedelta(days=3))

    result = deadlines.sweep_deadlines(db_session, today=TODAY)

    assert result.due_soon_sent == 1
    written = notices(db_session, seeded["community_member"].id)
    assert [n.type for n in written] == ["task.due_soon"]
    assert "3 days" in written[0].title


def test_says_nothing_two_days_out(db_session, seeded):
    make_task(db_session, seeded, due_on=TODAY + timedelta(days=2))

    result = deadlines.sweep_deadlines(db_session, today=TODAY)

    assert result.due_soon_sent == 0
    assert notices(db_session, seeded["community_member"].id) == []


def test_running_twice_in_one_day_writes_one_notice(db_session, seeded):
    make_task(db_session, seeded, due_on=TODAY + timedelta(days=1))

    first = deadlines.sweep_deadlines(db_session, today=TODAY)
    second = deadlines.sweep_deadlines(db_session, today=TODAY)

    assert first.due_soon_sent == 1
    assert second.due_soon_sent == 0
    assert second.duplicates == 1
    assert len(notices(db_session, seeded["community_member"].id)) == 1


def test_walks_through_the_whole_cadence_once_each(db_session, seeded):
    due = TODAY + timedelta(days=3)
    make_task(db_session, seeded, due_on=due)

    # Every day from the first warning to a week past due.
    for offset in range(11):
        deadlines.sweep_deadlines(db_session, today=TODAY + timedelta(days=offset))

    written = notices(db_session, seeded["community_member"].id)
    assert [n.type for n in written] == [
        "task.due_soon",  # 3 days out
        "task.due_soon",  # 1 day out
        "task.due_soon",  # due today
        "task.overdue",  # once, and never again
    ]


def test_overdue_survives_a_sweep_that_was_down(db_session, seeded):
    make_task(db_session, seeded, due_on=TODAY)

    # Nothing runs on the due date or the three days after it.
    deadlines.sweep_deadlines(db_session, today=TODAY + timedelta(days=4))

    written = notices(db_session, seeded["community_member"].id)
    assert [n.type for n in written] == ["task.overdue"]


def test_ignores_finished_unassigned_and_undated_tasks(db_session, seeded):
    make_task(db_session, seeded, due_on=TODAY, status="done", title="Done")
    make_task(db_session, seeded, due_on=TODAY, assignee=None, title="Nobody's")
    make_task(db_session, seeded, due_on=None, title="Someday")

    result = deadlines.sweep_deadlines(db_session, today=TODAY)

    assert result.considered == 0
    assert notices(db_session, seeded["community_member"].id) == []


def test_the_backfill_horizon_stops_ancient_tasks_stampeding(db_session, seeded):
    """The first run after a deploy must not email a year of old slippage."""
    make_task(db_session, seeded, due_on=TODAY - timedelta(days=400), title="Ancient")
    make_task(db_session, seeded, due_on=TODAY - timedelta(days=2), title="Recent")

    result = deadlines.sweep_deadlines(db_session, today=TODAY)

    assert result.considered == 1
    assert [n.body for n in notices(db_session, seeded["community_member"].id)]


def test_reassigning_gives_the_new_person_their_own_notice(db_session, seeded):
    task = make_task(db_session, seeded, due_on=TODAY + timedelta(days=1))
    deadlines.sweep_deadlines(db_session, today=TODAY)

    task.assignee_user_id = seeded["community_head"].id
    db_session.commit()
    deadlines.sweep_deadlines(db_session, today=TODAY)

    # The key is scoped to the recipient, so the first person's notice does
    # not silence the second.
    assert len(notices(db_session, seeded["community_member"].id)) == 1
    assert len(notices(db_session, seeded["community_head"].id)) == 1


def test_a_suppressed_notice_is_not_recorded_as_sent(db_session, seeded):
    """The reason the dedupe key lives on the notification row.

    A camper who has the switch off at the three-day mark and turns it back
    on must still hear about the deadline tomorrow. A "reminded" flag on the
    task would have marked the milestone done and lost them the notice.
    """
    member = seeded["community_member"]
    make_task(db_session, seeded, due_on=TODAY + timedelta(days=3))

    off = NotificationPreference(
        profile_id=member.id, event_type="task_due_soon", channel="in_app", enabled=False
    )
    db_session.add(off)
    db_session.commit()

    deadlines.sweep_deadlines(db_session, today=TODAY)
    assert notices(db_session, member.id) == []

    off.enabled = True
    db_session.commit()

    deadlines.sweep_deadlines(db_session, today=TODAY + timedelta(days=2))
    assert len(notices(db_session, member.id)) == 1


def test_overdue_still_reaches_a_paused_camper(db_session, seeded):
    member = seeded["community_member"]
    member.notifications_paused = True
    make_task(db_session, seeded, due_on=TODAY - timedelta(days=1))
    db_session.commit()

    deadlines.sweep_deadlines(db_session, today=TODAY)

    assert [n.type for n in notices(db_session, member.id)] == ["task.overdue"]


# ---------------------------------------------------------------------------
# Email
# ---------------------------------------------------------------------------


def test_emails_a_verified_camper(db_session, seeded):
    member = seeded["community_member"]
    member.email_verified = True
    make_task(db_session, seeded, due_on=TODAY + timedelta(days=1))
    db_session.commit()

    sender = RecordingSender()
    result = deadlines.sweep_deadlines(db_session, today=TODAY, sender=sender)

    assert result.emails_sent == 1
    assert sender.sent[0].to == member.email
    assert "Due tomorrow" in sender.sent[0].subject


def test_does_not_email_an_unverified_address(db_session, seeded):
    """The settings grid has shown email "on" since before any sender existed.

    Honouring that literally would mail the whole class on deploy day about
    a choice nobody made, so a verified address is the gate.
    """
    member = seeded["community_member"]
    assert member.email_verified is False
    make_task(db_session, seeded, due_on=TODAY + timedelta(days=1))

    sender = RecordingSender()
    result = deadlines.sweep_deadlines(db_session, today=TODAY, sender=sender)

    assert result.emails_sent == 0
    assert sender.sent == []
    # The in-app notice still lands.
    assert len(notices(db_session, member.id)) == 1


def test_email_respects_the_email_switch(db_session, seeded):
    member = seeded["community_member"]
    member.email_verified = True
    db_session.add(
        NotificationPreference(
            profile_id=member.id, event_type="task_due_soon",
            channel="email", enabled=False,
        )
    )
    make_task(db_session, seeded, due_on=TODAY + timedelta(days=1))
    db_session.commit()

    sender = RecordingSender()
    result = deadlines.sweep_deadlines(db_session, today=TODAY, sender=sender)

    assert result.emails_sent == 0
    assert len(notices(db_session, member.id)) == 1


def test_a_provider_outage_does_not_lose_the_in_app_notice(db_session, seeded):
    member = seeded["community_member"]
    member.email_verified = True
    make_task(db_session, seeded, due_on=TODAY + timedelta(days=1))
    db_session.commit()

    result = deadlines.sweep_deadlines(db_session, today=TODAY, sender=BrokenSender())

    assert result.emails_failed == 1
    assert result.due_soon_sent == 1
    assert len(notices(db_session, member.id)) == 1


def test_overdue_email_waits_for_quiet_hours_to_end(db_session, seeded):
    """Overdue may light up the bell at night. It may not buzz a phone."""
    member = seeded["community_member"]
    member.email_verified = True
    member.quiet_hours_start = time(22, 0)
    member.quiet_hours_end = time(7, 0)
    make_task(db_session, seeded, due_on=TODAY - timedelta(days=1))
    db_session.commit()

    sender = RecordingSender()
    # 06:30 UTC is 23:30 in America/Los_Angeles.
    at_night = datetime(2026, 8, 13, 6, 30, tzinfo=UTC)
    result = deadlines.sweep_deadlines(
        db_session, today=TODAY, now=at_night, sender=sender
    )

    assert result.overdue_sent == 1
    assert result.emails_sent == 0


# ---------------------------------------------------------------------------
# The trigger endpoint
# ---------------------------------------------------------------------------


@pytest.fixture
def job_secret(monkeypatch):
    from app.core.config import settings

    monkeypatch.setattr(settings, "job_trigger_secret", "test-secret")
    return "test-secret"


def test_the_job_endpoint_refuses_a_missing_secret(client, job_secret):
    assert client.post("/internal/jobs/deadline-reminders").status_code == 401


def test_the_job_endpoint_refuses_a_wrong_secret(client, job_secret):
    response = client.post(
        "/internal/jobs/deadline-reminders", headers={"X-L2Hub-Job-Secret": "wrong"}
    )
    assert response.status_code == 401


def test_the_job_endpoint_refuses_a_camper_token(client, make_token, seeded, job_secret):
    """A user token is the wrong instrument, not merely insufficient."""
    response = client.post(
        "/internal/jobs/deadline-reminders",
        headers={"Authorization": f"Bearer {make_token(sub=seeded['ac'].id)}"},
    )
    assert response.status_code == 401


def test_the_job_endpoint_is_unavailable_when_no_secret_is_set(client, monkeypatch):
    """An unconfigured server says so rather than running unauthenticated."""
    from app.core.config import settings

    monkeypatch.setattr(settings, "job_trigger_secret", "")
    response = client.post(
        "/internal/jobs/deadline-reminders", headers={"X-L2Hub-Job-Secret": "anything"}
    )
    assert response.status_code == 503


def test_calling_the_job_endpoint_twice_notifies_once(
    client, db_session, seeded, job_secret
):
    """pg_net is fire-and-forget, so a retry has to be free."""
    make_task(db_session, seeded, due_on=deadlines.local_today() + timedelta(days=1))
    headers = {"X-L2Hub-Job-Secret": job_secret}

    first = client.post("/internal/jobs/deadline-reminders", headers=headers)
    second = client.post("/internal/jobs/deadline-reminders", headers=headers)

    assert first.status_code == 200, first.text
    assert first.json()["dueSoon"] == 1
    assert second.json()["dueSoon"] == 0
    assert second.json()["duplicates"] == 1
    assert len(notices(db_session, seeded["community_member"].id)) == 1
