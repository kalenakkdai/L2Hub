"""Web push fan-out and subscription lifecycle.

Two responsibilities, kept apart:

  * `save_subscription` / `delete_subscription` — what a browser calls when a
    camper turns notifications on or off.
  * `send_to_profiles` — fan a notification out to every device belonging to a
    set of campers, pruning the ones the push service says are dead.

Preference gating is NOT repeated here. `notifications.deliver` already
decides who should hear about something, honouring per-event-type switches,
the global pause, and quiet hours; this module takes the list it produced and
puts bytes on the wire. Duplicating those rules would mean two places to fix
when one of them is wrong.
"""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.push import PushSubscription
from app.push.protocol import OutgoingPush, PushSender, PushTarget

logger = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class PushFanOut:
    """What one broadcast did. `pruned` is the count of dead rows deleted."""

    sent: int
    failed: int
    pruned: int


def save_subscription(
    db: Session,
    *,
    profile_id: uuid.UUID,
    endpoint: str,
    p256dh: str,
    auth: str,
    user_agent: str | None = None,
) -> PushSubscription:
    """Stores a browser's subscription, or refreshes it in place.

    Upserts on `endpoint` rather than inserting blindly. A browser that
    re-subscribes — after a permission reset, a service worker update, or a
    key rotation — usually hands back the SAME endpoint with new keys, so a
    plain insert would collide with the unique constraint, and keying on
    (profile_id, endpoint) would leave the old row behind on a shared device
    when a second camper signs in.

    That last case is why the profile_id is overwritten too: a school
    Chromebook where one camper signs out and another signs in produces one
    endpoint that must now belong to the second camper, not both.
    """
    existing = db.scalar(
        select(PushSubscription).where(PushSubscription.endpoint == endpoint)
    )

    if existing is not None:
        existing.profile_id = profile_id
        existing.p256dh = p256dh
        existing.auth = auth
        existing.user_agent = user_agent
        db.flush()
        return existing

    subscription = PushSubscription(
        id=uuid.uuid4(),
        profile_id=profile_id,
        endpoint=endpoint,
        p256dh=p256dh,
        auth=auth,
        user_agent=user_agent,
    )
    db.add(subscription)
    db.flush()
    return subscription


def delete_subscription(db: Session, *, profile_id: uuid.UUID, endpoint: str) -> bool:
    """Removes one browser's subscription. Returns whether a row was deleted.

    Scoped to the caller's own profile: an endpoint is guessable only in the
    sense that it could be observed, and unsubscribing someone else's phone
    should not be possible even so.
    """
    subscription = db.scalar(
        select(PushSubscription)
        .where(PushSubscription.endpoint == endpoint)
        .where(PushSubscription.profile_id == profile_id)
    )
    if subscription is None:
        return False

    db.delete(subscription)
    db.flush()
    return True


def list_for_profile(db: Session, profile_id: uuid.UUID) -> list[PushSubscription]:
    return list(
        db.scalars(
            select(PushSubscription)
            .where(PushSubscription.profile_id == profile_id)
            .order_by(PushSubscription.created_at)
        ).all()
    )


def send_to_profiles(
    db: Session,
    sender: PushSender | None,
    profile_ids: list[uuid.UUID],
    message: OutgoingPush,
    *,
    now: datetime | None = None,
) -> PushFanOut:
    """Pushes `message` to every device belonging to `profile_ids`.

    A dead subscription is deleted rather than retried. 404 and 410 are the
    only statuses treated that way — see DEAD_STATUSES in push/webpush.py for
    why a 500 or a 429 must leave the row alone.

    Never raises for a per-device failure. One camper's stale endpoint must
    not stop the other twenty-nine notifications in the same broadcast.
    """
    if sender is None or not profile_ids:
        return PushFanOut(sent=0, failed=0, pruned=0)

    moment = now or datetime.now(UTC)
    subscriptions = list(
        db.scalars(
            select(PushSubscription).where(
                PushSubscription.profile_id.in_(profile_ids)
            )
        ).all()
    )

    sent = 0
    failed = 0
    dead: list[PushSubscription] = []

    for subscription in subscriptions:
        target = PushTarget(
            endpoint=subscription.endpoint,
            p256dh=subscription.p256dh,
            auth=subscription.auth,
        )
        try:
            result = sender.send(target, message)
        except Exception:
            # A sender that raises instead of returning a result is a bug in
            # the sender, but it must not take the broadcast down with it.
            logger.exception("push sender raised for %s…", subscription.endpoint[:40])
            failed += 1
            continue

        if result.accepted:
            subscription.last_used_at = moment
            sent += 1
        elif result.gone:
            dead.append(subscription)
        else:
            failed += 1

    for subscription in dead:
        db.delete(subscription)

    if sent or dead:
        db.flush()

    return PushFanOut(sent=sent, failed=failed, pruned=len(dead))
