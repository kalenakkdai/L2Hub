"""In-app notification gating.

The rules are a pure function, so most of this needs no database. The
integration tests below use the real session fixture, because the thing worth
proving is that a preference row written by the settings grid actually stops a
notification from being created.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, time
from typing import ClassVar

import pytest

from app.models import NotificationPreference, Profile
from app.services import notifications


def _profile(db, **overrides) -> Profile:
    profile = Profile(
        id=uuid.uuid4(),
        email=f"{uuid.uuid4()}@example.test",
        full_name="Test Camper",
        status="active",
        **overrides,
    )
    db.add(profile)
    db.flush()
    return profile


def _prefer(db, profile_id: uuid.UUID, event_type: str, *, enabled: bool) -> None:
    db.add(
        NotificationPreference(
            profile_id=profile_id,
            event_type=event_type,
            channel="in_app",
            enabled=enabled,
        )
    )
    db.flush()


class TestQuietHours:
    @pytest.mark.parametrize(
        ("now", "expected"),
        [
            (time(23, 0), True),   # inside, after midnight boundary
            (time(2, 0), True),    # inside, past midnight
            (time(6, 59), True),
            (time(7, 0), False),   # end is exclusive
            (time(12, 0), False),
            (time(21, 59), False),
            (time(22, 0), True),   # start is inclusive
        ],
    )
    def test_window_wrapping_midnight(self, now: time, expected: bool) -> None:
        # 22:00-07:00 is the ordinary case, not an edge case.
        assert notifications.in_quiet_hours(now, time(22, 0), time(7, 0)) is expected

    @pytest.mark.parametrize(
        ("now", "expected"),
        [(time(13, 0), True), (time(9, 0), False), (time(17, 0), False)],
    )
    def test_window_within_one_day(self, now: time, expected: bool) -> None:
        assert notifications.in_quiet_hours(now, time(12, 0), time(14, 0)) is expected

    def test_no_window_when_either_end_is_unset(self) -> None:
        assert notifications.in_quiet_hours(time(3, 0), None, time(7, 0)) is False
        assert notifications.in_quiet_hours(time(3, 0), time(22, 0), None) is False

    def test_equal_start_and_end_is_not_all_day(self) -> None:
        # Otherwise a mis-set pair would silence everything forever.
        assert notifications.in_quiet_hours(time(3, 0), time(9, 0), time(9, 0)) is False


class TestShouldDeliver:
    BASE: ClassVar[dict] = {
        "event_type": "task_assigned",
        "enabled": True,
        "paused": False,
        "now": time(12, 0),
        "quiet_start": None,
        "quiet_end": None,
    }

    def test_delivers_by_default(self) -> None:
        assert notifications.should_deliver(**self.BASE) is True

    def test_respects_a_switched_off_preference(self) -> None:
        assert notifications.should_deliver(**{**self.BASE, "enabled": False}) is False

    def test_respects_the_pause_switch(self) -> None:
        assert notifications.should_deliver(**{**self.BASE, "paused": True}) is False

    def test_respects_quiet_hours(self) -> None:
        quiet = {**self.BASE, "now": time(23, 0), "quiet_start": time(22, 0), "quiet_end": time(7, 0)}
        assert notifications.should_deliver(**quiet) is False

    def test_overdue_ignores_quiet_hours_and_pause(self) -> None:
        # The settings page promises this in so many words.
        overdue = {
            **self.BASE,
            "event_type": "task_overdue",
            "enabled": False,
            "paused": True,
            "now": time(3, 0),
            "quiet_start": time(22, 0),
            "quiet_end": time(7, 0),
        }
        assert notifications.should_deliver(**overdue) is True

    def test_unmapped_types_are_always_delivered(self) -> None:
        # The grid never offered a switch, so nobody declined it.
        assert notifications.should_deliver(**{**self.BASE, "event_type": None}) is True


class TestDeliver:
    def test_writes_one_notification_per_willing_recipient(self, db_session) -> None:
        a, b = _profile(db_session), _profile(db_session)

        written = notifications.deliver(
            db_session, recipient_ids=[a.id, b.id],
            type="task.assigned", title="Task", body="You have a task",
        )

        assert written.written == 2
        assert notifications.unread_count(db_session, a.id) == 1

    def test_skips_a_camper_who_switched_the_type_off(self, db_session) -> None:
        wants, declines = _profile(db_session), _profile(db_session)
        _prefer(db_session, declines.id, "task_assigned", enabled=False)

        written = notifications.deliver(
            db_session, recipient_ids=[wants.id, declines.id],
            type="task.assigned", title="Task", body="",
        )

        assert written.written == 1
        assert notifications.unread_count(db_session, declines.id) == 0
        assert notifications.unread_count(db_session, wants.id) == 1

    def test_a_preference_for_another_type_does_not_leak(self, db_session) -> None:
        camper = _profile(db_session)
        _prefer(db_session, camper.id, "level_up", enabled=False)

        written = notifications.deliver(
            db_session, recipient_ids=[camper.id], type="task.assigned", title="T", body="")

        assert written.written == 1

    def test_a_preference_on_another_channel_does_not_gate_in_app(self, db_session) -> None:
        camper = _profile(db_session)
        db_session.add(
            NotificationPreference(
                profile_id=camper.id, event_type="task_assigned",
                channel="email", enabled=False,
            )
        )
        db_session.flush()

        # Switching off email must not silence the in-app notification.
        assert notifications.deliver(
            db_session, recipient_ids=[camper.id], type="task.assigned",
            title="T", body="").written == 1

    def test_skips_a_paused_camper(self, db_session) -> None:
        camper = _profile(db_session, notifications_paused=True)

        assert notifications.deliver(
            db_session, recipient_ids=[camper.id], type="task.assigned",
            title="T", body="").written == 0

    def test_skips_during_quiet_hours(self, db_session) -> None:
        camper = _profile(db_session, quiet_hours_start=time(22, 0), quiet_hours_end=time(7, 0))

        # Quiet hours are set as local wall-clock times in the settings page,
        # so the instants here are written as UTC but chosen for what they
        # mean in America/Los_Angeles: 23:30 PDT is 06:30 UTC the next day.
        at_night = datetime(2026, 8, 9, 6, 30, tzinfo=UTC)
        assert notifications.deliver(
            db_session, recipient_ids=[camper.id], type="task.assigned",
            title="T", body="", now=at_night).written == 0

        midday = datetime(2026, 8, 8, 19, 0, tzinfo=UTC)  # 12:00 PDT
        assert notifications.deliver(
            db_session, recipient_ids=[camper.id], type="task.assigned",
            title="T", body="", now=midday).written == 1

    def test_a_utc_clock_is_not_mistaken_for_a_local_one(self, db_session) -> None:
        """23:30 UTC is 16:30 in California, which is nobody's quiet hours.

        Comparing the two directly used to silence the wrong nine hours of
        the day; the daily deadline sweep runs at a fixed UTC instant, which
        would have made that a permanent miss rather than an occasional one.
        """
        camper = _profile(db_session, quiet_hours_start=time(22, 0), quiet_hours_end=time(7, 0))

        assert notifications.deliver(
            db_session, recipient_ids=[camper.id], type="task.assigned", title="T", body="",
            now=datetime(2026, 8, 8, 23, 30, tzinfo=UTC)).written == 1

    def test_overdue_arrives_during_quiet_hours(self, db_session) -> None:
        camper = _profile(
            db_session, quiet_hours_start=time(22, 0), quiet_hours_end=time(7, 0),
            notifications_paused=True,
        )

        assert notifications.deliver(
            db_session, recipient_ids=[camper.id], type="task.overdue", title="Late", body="",
            now=datetime(2026, 8, 9, 6, 30, tzinfo=UTC)).written == 1

    def test_ignores_a_recipient_that_does_not_exist(self, db_session) -> None:
        assert notifications.deliver(
            db_session, recipient_ids=[uuid.uuid4()], type="task.assigned",
            title="T", body="").written == 0


class TestMarkRead:
    def test_marks_everything_read(self, db_session) -> None:
        camper = _profile(db_session)
        notifications.deliver(
            db_session, recipient_ids=[camper.id], type="task.assigned", title="T", body="")
        notifications.deliver(
            db_session, recipient_ids=[camper.id], type="level.up", title="L", body="")

        assert notifications.mark_all_read(db_session, camper.id) == 2
        assert notifications.unread_count(db_session, camper.id) == 0

    def test_does_not_touch_another_camper(self, db_session) -> None:
        mine, theirs = _profile(db_session), _profile(db_session)
        notifications.deliver(
            db_session, recipient_ids=[mine.id, theirs.id], type="task.assigned",
            title="T", body="")

        notifications.mark_all_read(db_session, mine.id)

        assert notifications.unread_count(db_session, theirs.id) == 1

    def test_marking_one_is_scoped_to_its_owner(self, db_session) -> None:
        from app.models import Notification

        mine, theirs = _profile(db_session), _profile(db_session)
        notifications.deliver(
            db_session, recipient_ids=[theirs.id], type="task.assigned", title="T", body="")
        db_session.flush()
        note = db_session.query(Notification).filter_by(recipient_user_id=theirs.id).one()

        # Someone else's id must match nothing, not raise and not succeed.
        assert notifications.mark_read(db_session, mine.id, note.id) == 0
        assert notifications.unread_count(db_session, theirs.id) == 1


class TestSourcedEventTypes:
    """Every offered switch must have an emitter behind it.

    The settings grid once showed all eight schema event types. Seven had no
    code path that could raise them, so those switches recorded a choice and
    changed nothing. These tests fail if the two lists drift apart again.
    """

    def test_sourced_types_are_real_event_types(self) -> None:
        assert notifications.SOURCED_EVENT_TYPES <= set(notifications.EVENT_TYPES)

    def test_every_sourced_type_has_an_emitter(self) -> None:
        """A switch the grid offers must be reachable from some notification."""
        routed = set(notifications.TYPE_TO_EVENT_TYPE.values())
        unreachable = notifications.SOURCED_EVENT_TYPES - routed
        assert not unreachable, (
            f"offered in the settings grid but nothing maps to it: {sorted(unreachable)}"
        )

    def test_emitted_types_are_gated_by_a_sourced_switch(self) -> None:
        """The reverse: anything actually emitted must be switchable.

        Scans the source for the `type=` argument of every deliver() call
        rather than trusting the mapping table, so a new emitter that forgot
        its preference row is caught here instead of in production.
        """
        import re
        from pathlib import Path

        service_dir = Path(notifications.__file__).parent
        emitted: set[str] = set()
        for path in service_dir.rglob("*.py"):
            if path.name == "notifications.py":
                continue
            for match in re.finditer(r'type="([a-z]+\.[a-z_]+)"', path.read_text()):
                emitted.add(match.group(1))

        assert emitted, "found no emitters to check — has the call shape changed?"

        for notification_type in sorted(emitted):
            event_type = notifications.TYPE_TO_EVENT_TYPE.get(notification_type)
            assert event_type is not None, (
                f"{notification_type} is emitted but has no preference mapping"
            )
            assert event_type in notifications.SOURCED_EVENT_TYPES, (
                f"{notification_type} is emitted but {event_type} is not offered "
                "in the settings grid, so a camper cannot switch it off"
            )
