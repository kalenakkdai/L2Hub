"""Activities Calendar sync + Jan's three-month planning reminders."""

from __future__ import annotations

from datetime import date
from types import SimpleNamespace

from sqlalchemy import select

from app.db.seed import seed_development_users
from app.models import Notification
from app.models.event_summary import Event
from app.services import jan
from app.services.activities_calendar_sync import sync_activities_calendar
from app.services.planning_reminders import months_before, should_remind, sweep_planning_reminders


def test_months_before_clamps_end_of_month():
    assert months_before(date(2027, 5, 31), 3) == date(2027, 2, 28)
    assert months_before(date(2026, 10, 9), 3) == date(2026, 7, 9)


def test_should_remind_opens_at_three_months_and_stays_until_event():
    event_on = date(2026, 10, 9)
    assert not should_remind(event_on=event_on, today=date(2026, 7, 8))
    assert should_remind(event_on=event_on, today=date(2026, 7, 9))
    assert should_remind(event_on=event_on, today=date(2026, 9, 1))
    assert not should_remind(event_on=event_on, today=date(2026, 10, 9))
    assert not should_remind(event_on=event_on, today=date(2026, 10, 10))


def test_sync_upserts_asb_and_calendar_only_rows(db_session):
    first = sync_activities_calendar(db_session)
    db_session.commit()
    assert first.planning_events == 14
    assert first.created + first.updated == first.considered

    fall = db_session.scalar(select(Event).where(Event.name == "Fall Rally"))
    assert fall is not None
    assert fall.status != "calendar"
    assert fall.starts_at is not None
    assert "Needs planning" in (fall.description or "")

    council = db_session.scalar(
        select(Event).where(Event.slug.like("activities-%-council-%"))
    )
    assert council is not None
    assert council.status == "calendar"

    second = sync_activities_calendar(db_session)
    db_session.commit()
    assert second.created == 0
    assert second.updated == second.considered

    # Seed catalog keeps maze-day-2025 outside the Activities Calendar export.
    asb_and_feed = db_session.scalars(
        select(Event).where(
            (Event.description.is_not(None))
            & Event.description.like("Activities Calendar%")
        )
    ).all()
    assert len(asb_and_feed) == first.considered


def test_list_events_hides_calendar_status(make_profile, make_token, client, db_session):
    sync_activities_calendar(db_session)
    db_session.commit()
    ac = make_profile(email="ac@l2hub.local", full_name="Mr. Jan", role="ac")
    response = client.get(
        "/events",
        headers={"Authorization": f"Bearer {make_token(sub=ac.id)}"},
    )
    assert response.status_code == 200
    names = {row["name"] for row in response.json()["events"]}
    assert "Fall Rally" in names
    assert "Green & White Rally" in names
    assert not any("Vball" in name or name.startswith("Council") for name in names)


def test_planning_reminder_goes_only_to_jan(db_session, make_profile):
    jan_user = make_profile(email="ac@l2hub.local", full_name="Mr. Jan", role="ac")
    other_ac = make_profile(
        email="kalena@example.edu", full_name="Kalena Dai", role="ac"
    )
    sync_activities_calendar(db_session)
    db_session.commit()

    # Fall Rally is 2026-10-09 → remind from 2026-07-09.
    result = sweep_planning_reminders(db_session, today=date(2026, 7, 9))
    db_session.commit()
    assert result.sent >= 1

    rows = db_session.scalars(
        select(Notification).where(Notification.type == "event.planning_start")
    ).all()
    recipients = {row.recipient_user_id for row in rows}
    assert jan_user.id in recipients
    assert other_ac.id not in recipients

    again = sweep_planning_reminders(db_session, today=date(2026, 7, 10))
    db_session.commit()
    assert again.duplicates >= 1


def test_jan_resolver_matches_email_and_name():
    assert jan.is_jan(SimpleNamespace(email="ac@l2hub.local", full_name="X"))
    assert jan.is_jan(SimpleNamespace(email="x@y.z", full_name="Mr. Jan"))
    assert not jan.is_jan(
        SimpleNamespace(email="kalena@example.edu", full_name="Kalena Dai")
    )


def test_seed_syncs_maze_day_to_activities_calendar_dates(db_session):
    seed_development_users(db_session)
    db_session.commit()
    maze = db_session.scalar(select(Event).where(Event.slug == "maze-day-2026"))
    assert maze is not None
    assert maze.starts_at is not None
    assert maze.starts_at.date().isoformat() == "2026-08-06"
