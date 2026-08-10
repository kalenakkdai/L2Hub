"""Gradebook write helpers: permission side-effects and peer transparency.

Persistence is still thin (stub routes), but every assign / grade / publish
notifies the other gradebook operator so Jan and Jadon stay in sync.
"""

from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.models.profile import Profile
from app.services import notifications
from app.services.gradebook_operators import peer_operator_ids


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
