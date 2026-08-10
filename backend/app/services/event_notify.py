"""Announce a newly published event to the campers it concerns.

Kept out of `event_summary/service.py` on purpose: promotion is a database
operation that must succeed or fail on its own terms, and a push provider
having a bad afternoon is not a reason for an event to fail to publish.
"""

from __future__ import annotations

import logging
import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import CommitteeMembership, Event
from app.models.profile import Profile
from app.push.protocol import OutgoingPush, PushSender
from app.services import notifications
from app.services import push as push_service

logger = logging.getLogger(__name__)


def recipients_for(db: Session, event: Event) -> list[uuid.UUID]:
    """Who should hear that this event exists.

    A Crew event goes to that Crew's members. An event with no managing
    Committee is a Campsite-wide one — Fall Rally, a rally schedule change —
    and goes to everyone, which is the only reading that does not silently
    drop the announcement.
    """
    if event.managing_committee_id is not None:
        return list(
            db.scalars(
                select(CommitteeMembership.user_id).where(
                    CommitteeMembership.committee_id == event.managing_committee_id
                )
            ).all()
        )

    return list(db.scalars(select(Profile.id)).all())


def announce_event(
    db: Session,
    event: Event,
    *,
    sender: PushSender | None = None,
    exclude: uuid.UUID | None = None,
) -> notifications.DeliveryResult:
    """Writes the in-app notice and fans out the push.

    `exclude` drops the camper who published the event — being notified about
    your own action reads as a bug.

    Deduped on the event id, so re-promoting the same plan (which the
    promotion path does idempotently) does not re-announce it.
    """
    recipient_ids = [r for r in recipients_for(db, event) if r != exclude]
    if not recipient_ids:
        return notifications.DeliveryResult()

    crew = event.managing_committee.name if event.managing_committee else None
    body = (
        f"{crew} posted a new event." if crew else "A new event was added to The Quad."
    )

    result = notifications.deliver(
        db,
        recipient_ids=recipient_ids,
        type="event.created",
        title=event.name,
        body=body,
        payload={"eventId": str(event.id), "slug": event.slug},
        dedupe_key=f"event.created:{event.id}",
        push=True,
    )

    # After the notification rows exist, but the caller still owns the commit.
    # A push that goes out before the transaction lands would announce an
    # event that a rollback then erased.
    if result.pending_push and sender is not None:
        try:
            push_service.send_to_profiles(
                db,
                sender,
                list(result.pending_push),
                OutgoingPush(
                    title=event.name,
                    body=body,
                    url=f"/events/{event.slug}",
                    # One tag per event: a re-announcement replaces the old
                    # notification in the tray instead of stacking.
                    tag=f"event-{event.id}",
                ),
            )
        except Exception:
            # Best-effort, exactly like email. The in-app notification is the
            # channel of record and it has already been written.
            logger.exception("push fan-out failed for event %s", event.id)

    return result
