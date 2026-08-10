"""Who has full gradebook control: Mr. Jan (AC) and Jadon Li (ASB President).

Both may assign, enter, publish, edit rubrics, and approve draft requests.
Every change one makes notifies the other so the gradebook stays transparent
between them. Heads send assignment drafts and enter committee-category
class grades separately.
"""

from __future__ import annotations

import re
import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.profile import Profile
from app.models.rbac import Role, UserRoleAssignment

GRADEBOOK_OPERATOR_EMAILS: frozenset[str] = frozenset(
    {
        "ac@l2hub.local",  # seed / local Mr. Jan
        "president@l2hub.local",  # seed / local ASB President
        "jadonli2020@gmail.com",  # Jadon Li
    }
)

GRADEBOOK_OPERATOR_NAMES: frozenset[str] = frozenset(
    {
        "mr jan",
        "jadon li",
    }
)


def _normalize_name(name: str) -> str:
    cleaned = re.sub(r"\([^)]*\)", "", name or "")
    cleaned = re.sub(r"[^a-z0-9\s]", " ", cleaned.lower())
    return " ".join(cleaned.split())


def is_gradebook_operator(profile: Profile) -> bool:
    email = (getattr(profile, "email", None) or "").strip().lower()
    if email in GRADEBOOK_OPERATOR_EMAILS:
        return True
    return _normalize_name(getattr(profile, "full_name", None) or "") in GRADEBOOK_OPERATOR_NAMES


def resolve_gradebook_operator_ids(db: Session) -> list[uuid.UUID]:
    """Active profiles that should receive peer gradebook transparency notices.

    Prefer the Jan / Jadon allowlist. If neither account is linked yet, fall
    back to every active AC and President so a change is never silent.
    """
    matched: list[uuid.UUID] = []
    for profile in db.scalars(select(Profile).where(Profile.status == "active")):
        if is_gradebook_operator(profile):
            matched.append(profile.id)
    if matched:
        return list(dict.fromkeys(matched))

    fallback = db.scalars(
        select(UserRoleAssignment.user_id)
        .join(Role, Role.id == UserRoleAssignment.role_id)
        .where(Role.slug.in_(("ac", "president")))
    ).all()
    return list(dict.fromkeys(fallback))


def peer_operator_ids(db: Session, actor_id: uuid.UUID) -> list[uuid.UUID]:
    """The other gradebook operator(s) — everyone on the allowlist except the actor."""
    return [uid for uid in resolve_gradebook_operator_ids(db) if uid != actor_id]
