"""Web push: subscription lifecycle, dead-endpoint pruning, and the fan-out.

Everything here runs against SQLite with a fake PushSender. Nothing in this
file touches a real push service, a real VAPID keypair, or the shared Supabase
project — and the migration that creates push_subscriptions has deliberately
not been applied anywhere, so these tests exercise the ORM's idea of the table
rather than the database's.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, time

import pytest
from sqlalchemy import select

from app.db.seed import seed_development_users
from app.models import Committee, CommitteeMembership
from app.models.event_summary import Event, NotificationPreference
from app.models.push import PushSubscription
from app.push.protocol import OutgoingPush, PushResult, PushTarget
from app.services import notifications
from app.services import push as push_service

ENDPOINT = "https://fcm.googleapis.com/fcm/send/abc123"


@pytest.fixture
def seeded(db_session):
    return seed_development_users(db_session)


def auth_header(make_token, user_id: uuid.UUID) -> dict[str, str]:
    return {"Authorization": f"Bearer {make_token(sub=user_id)}"}


class FakeSender:
    """Records what it was asked to send and answers with scripted results."""

    def __init__(self, results: dict[str, PushResult] | None = None) -> None:
        self.results = results or {}
        self.sent: list[tuple[PushTarget, OutgoingPush]] = []

    def send(self, target: PushTarget, message: OutgoingPush) -> PushResult:
        self.sent.append((target, message))
        return self.results.get(target.endpoint, PushResult(accepted=True))


def subscribe(db_session, profile_id, endpoint=ENDPOINT, agent="Chrome"):
    subscription = push_service.save_subscription(
        db_session,
        profile_id=profile_id,
        endpoint=endpoint,
        p256dh="key",
        auth="secret",
        user_agent=agent,
    )
    db_session.commit()
    return subscription


# ---------------------------------------------------------------------------
# Subscription lifecycle
# ---------------------------------------------------------------------------


def test_subscribing_stores_the_browsers_keys(db_session, seeded):
    subscription = subscribe(db_session, seeded["president"].id)
    assert subscription.endpoint == ENDPOINT
    assert subscription.p256dh == "key"


def test_resubscribing_the_same_browser_updates_rather_than_duplicates(
    db_session, seeded
):
    """A browser re-subscribing hands back the same endpoint with new keys."""
    subscribe(db_session, seeded["president"].id)
    push_service.save_subscription(
        db_session,
        profile_id=seeded["president"].id,
        endpoint=ENDPOINT,
        p256dh="rotated",
        auth="rotated-secret",
    )
    db_session.commit()

    rows = db_session.scalars(select(PushSubscription)).all()
    assert len(rows) == 1
    assert rows[0].p256dh == "rotated"


def test_a_shared_device_moves_to_whoever_signed_in_last(db_session, seeded):
    """A school Chromebook produces one endpoint for two campers in a day."""
    subscribe(db_session, seeded["president"].id)
    push_service.save_subscription(
        db_session,
        profile_id=seeded["community_member"].id,
        endpoint=ENDPOINT,
        p256dh="key",
        auth="secret",
    )
    db_session.commit()

    rows = db_session.scalars(select(PushSubscription)).all()
    assert len(rows) == 1
    assert rows[0].profile_id == seeded["community_member"].id


def test_one_camper_can_hold_several_devices(db_session, seeded):
    subscribe(db_session, seeded["president"].id, endpoint="https://a.example/1")
    subscribe(db_session, seeded["president"].id, endpoint="https://b.example/2")
    assert len(push_service.list_for_profile(db_session, seeded["president"].id)) == 2


def test_unsubscribing_removes_only_that_device(db_session, seeded):
    subscribe(db_session, seeded["president"].id, endpoint="https://a.example/1")
    subscribe(db_session, seeded["president"].id, endpoint="https://b.example/2")

    assert push_service.delete_subscription(
        db_session, profile_id=seeded["president"].id, endpoint="https://a.example/1"
    )
    db_session.commit()

    remaining = push_service.list_for_profile(db_session, seeded["president"].id)
    assert [s.endpoint for s in remaining] == ["https://b.example/2"]


def test_cannot_unsubscribe_someone_elses_device(db_session, seeded):
    subscribe(db_session, seeded["president"].id)
    removed = push_service.delete_subscription(
        db_session, profile_id=seeded["community_member"].id, endpoint=ENDPOINT
    )
    assert removed is False
    assert db_session.scalars(select(PushSubscription)).all()


# ---------------------------------------------------------------------------
# Dead-endpoint pruning — the requirement that matters most
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("status_code", [404, 410])
def test_dead_subscriptions_are_deleted(db_session, seeded, status_code):
    subscribe(db_session, seeded["president"].id)
    sender = FakeSender(
        {ENDPOINT: PushResult(accepted=False, gone=True, status_code=status_code)}
    )

    result = push_service.send_to_profiles(
        db_session, sender, [seeded["president"].id], OutgoingPush("T", "B")
    )
    db_session.commit()

    assert result.pruned == 1
    assert db_session.scalars(select(PushSubscription)).all() == []


@pytest.mark.parametrize("status_code", [429, 500, 502, 503])
def test_transient_failures_keep_the_subscription(db_session, seeded, status_code):
    """A vendor outage must not silently unsubscribe everyone using it."""
    subscribe(db_session, seeded["president"].id)
    sender = FakeSender(
        {ENDPOINT: PushResult(accepted=False, gone=False, status_code=status_code)}
    )

    result = push_service.send_to_profiles(
        db_session, sender, [seeded["president"].id], OutgoingPush("T", "B")
    )
    db_session.commit()

    assert result.pruned == 0
    assert result.failed == 1
    assert len(db_session.scalars(select(PushSubscription)).all()) == 1


def test_one_dead_device_does_not_stop_the_others(db_session, seeded):
    subscribe(db_session, seeded["president"].id, endpoint="https://dead.example/1")
    subscribe(db_session, seeded["president"].id, endpoint="https://live.example/2")
    sender = FakeSender(
        {"https://dead.example/1": PushResult(accepted=False, gone=True, status_code=410)}
    )

    result = push_service.send_to_profiles(
        db_session, sender, [seeded["president"].id], OutgoingPush("T", "B")
    )
    db_session.commit()

    assert result.sent == 1
    assert result.pruned == 1


def test_a_sender_that_raises_does_not_abort_the_broadcast(db_session, seeded):
    subscribe(db_session, seeded["president"].id, endpoint="https://boom.example/1")
    subscribe(db_session, seeded["president"].id, endpoint="https://fine.example/2")

    class Exploding(FakeSender):
        def send(self, target, message):
            if "boom" in target.endpoint:
                raise RuntimeError("provider client bug")
            return super().send(target, message)

    result = push_service.send_to_profiles(
        db_session, Exploding(), [seeded["president"].id], OutgoingPush("T", "B")
    )
    assert result.sent == 1
    assert result.failed == 1


def test_successful_send_stamps_last_used(db_session, seeded):
    subscribe(db_session, seeded["president"].id)
    push_service.send_to_profiles(
        db_session, FakeSender(), [seeded["president"].id], OutgoingPush("T", "B")
    )
    db_session.commit()

    row = db_session.scalar(select(PushSubscription))
    assert row.last_used_at is not None


def test_no_sender_configured_sends_nothing(db_session, seeded):
    subscribe(db_session, seeded["president"].id)
    result = push_service.send_to_profiles(
        db_session, None, [seeded["president"].id], OutgoingPush("T", "B")
    )
    assert result == push_service.PushFanOut(sent=0, failed=0, pruned=0)


# ---------------------------------------------------------------------------
# Preference gating
# ---------------------------------------------------------------------------


def test_quiet_hours_suppress_push(db_session, seeded):
    """A buzzing phone at 2am is exactly what quiet hours are for."""
    assert not notifications.wants_push(
        event_type="event_created",
        push_enabled=True,
        paused=False,
        now=time(2, 0),
        quiet_start=time(22, 0),
        quiet_end=time(7, 0),
    )


def test_pause_suppresses_push(db_session):
    assert not notifications.wants_push(
        event_type="event_created",
        push_enabled=True,
        paused=True,
        now=time(12, 0),
        quiet_start=None,
        quiet_end=None,
    )


def test_push_off_for_this_event_type_suppresses_it(db_session):
    assert not notifications.wants_push(
        event_type="event_created",
        push_enabled=False,
        paused=False,
        now=time(12, 0),
        quiet_start=None,
        quiet_end=None,
    )


def test_deliver_returns_push_recipients_only_when_asked(db_session, seeded):
    result = notifications.deliver(
        db_session,
        recipient_ids=[seeded["president"].id],
        type="event.created",
        title="Fall Rally",
        body="A new event",
    )
    assert result.pending_push == ()

    result = notifications.deliver(
        db_session,
        recipient_ids=[seeded["president"].id],
        type="event.created",
        title="Fall Rally",
        body="A new event",
        dedupe_key="unique-key",
        push=True,
    )
    assert result.pending_push == (seeded["president"].id,)


def test_deliver_honours_a_push_switch_that_is_off(db_session, seeded):
    db_session.add(
        NotificationPreference(
            profile_id=seeded["president"].id,
            event_type="event_created",
            channel="push",
            enabled=False,
        )
    )
    db_session.commit()

    result = notifications.deliver(
        db_session,
        recipient_ids=[seeded["president"].id],
        type="event.created",
        title="Fall Rally",
        body="A new event",
        push=True,
    )
    # The in-app row is still written — only the push is declined.
    assert result.written == 1
    assert result.pending_push == ()


# ---------------------------------------------------------------------------
# Announcing a new event
# ---------------------------------------------------------------------------


def _event(db_session, committee_id=None) -> Event:
    event = Event(
        id=uuid.uuid4(),
        name="Fall Rally",
        slug=f"fall-rally-{uuid.uuid4().hex[:8]}",
        year=2026,
        status="active",
        starts_at=datetime(2026, 10, 1, 15, 0, tzinfo=UTC),
        managing_committee_id=committee_id,
    )
    db_session.add(event)
    db_session.commit()
    return event


def _populated_committee(db_session) -> Committee:
    """A Committee the seed actually put people in.

    Not `select(Committee).first()` — the seed creates several committees and
    only staffs some of them, so the first one has no members and every
    assertion about fan-out would pass vacuously.
    """
    committee_id = db_session.scalar(select(CommitteeMembership.committee_id))
    assert committee_id is not None, "seed should staff at least one committee"
    return db_session.get(Committee, committee_id)


def test_a_crew_event_goes_to_that_crews_members(db_session, seeded):
    from app.services import event_notify

    committee = _populated_committee(db_session)
    members = db_session.scalars(
        select(CommitteeMembership.user_id).where(
            CommitteeMembership.committee_id == committee.id
        )
    ).all()
    assert members, "seed should give this committee members"

    event = _event(db_session, committee_id=committee.id)
    recipients = event_notify.recipients_for(db_session, event)
    assert set(recipients) == set(members)


def test_an_event_with_no_crew_goes_to_everyone(db_session, seeded):
    from app.services import event_notify

    event = _event(db_session)
    recipients = event_notify.recipients_for(db_session, event)
    assert len(recipients) >= len(seeded)


def test_announcing_pushes_to_crew_members(db_session, seeded):
    from app.services import event_notify

    committee = _populated_committee(db_session)
    member_id = db_session.scalar(
        select(CommitteeMembership.user_id).where(
            CommitteeMembership.committee_id == committee.id
        )
    )
    subscribe(db_session, member_id)

    sender = FakeSender()
    event = _event(db_session, committee_id=committee.id)
    event_notify.announce_event(db_session, event, sender=sender)
    db_session.commit()

    assert len(sender.sent) == 1
    _target, message = sender.sent[0]
    assert message.title == "Fall Rally"
    assert message.url.startswith("/events/")


def test_the_publisher_is_not_notified_about_their_own_event(db_session, seeded):
    from app.services import event_notify

    event = _event(db_session)
    result = event_notify.announce_event(
        db_session, event, sender=FakeSender(), exclude=seeded["president"].id
    )
    assert seeded["president"].id not in result.pending_push


def test_announcing_the_same_event_twice_is_deduped(db_session, seeded):
    from app.services import event_notify

    event = _event(db_session)
    first = event_notify.announce_event(db_session, event, sender=FakeSender())
    db_session.commit()
    second = event_notify.announce_event(db_session, event, sender=FakeSender())
    db_session.commit()

    assert first.written > 0
    assert second.written == 0
    assert second.duplicates == first.written


# ---------------------------------------------------------------------------
# HTTP surface
# ---------------------------------------------------------------------------


def test_subscribe_endpoint_stores_the_subscription(client, make_token, seeded):
    response = client.post(
        "/push/subscribe",
        headers=auth_header(make_token, seeded["president"].id),
        json={
            "endpoint": ENDPOINT,
            "keys": {"p256dh": "key", "auth": "secret"},
            "userAgent": "Chrome on Android",
        },
    )
    assert response.status_code == 201
    assert response.json()["subscribed"] is True


def test_subscribe_requires_a_session(client):
    response = client.post(
        "/push/subscribe",
        json={"endpoint": ENDPOINT, "keys": {"p256dh": "k", "auth": "a"}},
    )
    assert response.status_code == 401


def test_unsubscribe_is_idempotent(client, make_token, seeded):
    """The browser may already have dropped it; that is the desired state."""
    response = client.post(
        "/push/unsubscribe",
        headers=auth_header(make_token, seeded["president"].id),
        json={"endpoint": "https://never.subscribed/x"},
    )
    assert response.status_code == 200
    assert response.json()["removed"] is False


def test_device_list_never_returns_a_full_endpoint(client, make_token, seeded, db_session):
    """The endpoint is the sensitive half of a subscription."""
    subscribe(db_session, seeded["president"].id)

    response = client.get(
        "/push/subscriptions", headers=auth_header(make_token, seeded["president"].id)
    )
    devices = response.json()["devices"]

    assert len(devices) == 1
    assert ENDPOINT not in response.text
    assert devices[0]["endpointSuffix"] == ENDPOINT[-12:]


def test_device_list_is_scoped_to_the_caller(client, make_token, seeded, db_session):
    subscribe(db_session, seeded["president"].id)
    response = client.get(
        "/push/subscriptions",
        headers=auth_header(make_token, seeded["community_member"].id),
    )
    assert response.json()["devices"] == []


def test_config_reports_push_disabled_without_a_key(client):
    """The settings UI needs to say why rather than offer a broken switch."""
    body = client.get("/push/config").json()
    assert body["enabled"] is False
    assert body["vapidPublicKey"] is None
