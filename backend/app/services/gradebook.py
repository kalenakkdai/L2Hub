"""Gradebook write helpers: permission side-effects and peer transparency.

Persistence is still thin (stub routes), but every assign / grade / publish
notifies the other gradebook operator so Jan and Jadon stay in sync.
Heads' draft requests and committee-category grades notify operators.
"""

from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.models.profile import Profile
from app.services import notifications
from app.services.gradebook_operators import (
    peer_operator_ids,
    resolve_gradebook_operator_ids,
)


def _actor_label(profile: Profile) -> str:
    return (profile.full_name or "").strip() or (profile.email or "Someone")


def notify_peer_gradebook_change(
    db: Session,
    actor: Profile,
    *,
    action: str,
    detail: str,
    payload: dict | None = None,
) -> None:
    """Tell the other gradebook operator what just changed.

    `action` is a short verb phrase ("published grades", "assigned a rubric",
    "entered a score"). Delivery is best-effort and never blocks the write.
    """
    peers = peer_operator_ids(db, actor.id)
    if not peers:
        return
    actor_name = _actor_label(actor)
    notifications.deliver(
        db,
        recipient_ids=peers,
        type="grades.changed",
        title=f"{actor_name} {action}",
        body=detail,
        payload=payload or {},
        dedupe_key=f"grades.changed:{actor.id}:{action}:{detail}",
    )


def notify_operators_assignment_request(
    db: Session,
    actor: Profile,
    *,
    title: str,
    request_id: uuid.UUID,
    committee_id: uuid.UUID,
) -> None:
    """Notify Jan (and Jadon) that a head sent a draft assignment request."""
    recipients = resolve_gradebook_operator_ids(db)
    if not recipients:
        return
    actor_name = _actor_label(actor)
    notifications.deliver(
        db,
        recipient_ids=recipients,
        type="grades.assignment_requested",
        title=f"{actor_name} requested a new assignment",
        body=f'Draft: "{title}" — review and approve to add it to the gradebook.',
        payload={
            "requestId": str(request_id),
            "committeeId": str(committee_id),
            "href": "/grades/requests",
        },
        dedupe_key=f"grades.assignment_requested:{request_id}",
    )


def notify_operators_committee_grades(
    db: Session,
    actor: Profile,
    *,
    committee_id: uuid.UUID,
    score_count: int,
) -> None:
    """Notify Jan/Jadon that a head submitted committee-category class grades."""
    recipients = resolve_gradebook_operator_ids(db)
    if not recipients:
        return
    actor_name = _actor_label(actor)
    notifications.deliver(
        db,
        recipient_ids=recipients,
        type="grades.committee_submitted",
        title=f"{actor_name} submitted committee grades",
        body=(
            f"{score_count} class score{'s' if score_count != 1 else ''} "
            "in the Committee grades category — publish when ready."
        ),
        payload={
            "committeeId": str(committee_id),
            "href": "/grades/committee",
        },
        dedupe_key=(
            f"grades.committee_submitted:{actor.id}:{committee_id}:{score_count}"
        ),
    )
