"""Resolve Mr. Jan's profile for adviser-only notifications."""

from __future__ import annotations

import re
import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.profile import Profile
from app.models.rbac import Role, UserRoleAssignment

JAN_EMAILS: frozenset[str] = frozenset(
    {
        "ac@l2hub.local",
    }
)

JAN_NAMES: frozenset[str] = frozenset(
    {
        "mr jan",
    }
)


def _normalize_name(name: str) -> str:
    cleaned = re.sub(r"\([^)]*\)", "", name or "")
    cleaned = re.sub(r"[^a-z0-9\s]", " ", cleaned.lower())
    return " ".join(cleaned.split())


def is_jan(profile: Profile) -> bool:
    email = (profile.email or "").strip().lower()
    if email in JAN_EMAILS:
        return True
    return _normalize_name(profile.full_name or "") in JAN_NAMES


def resolve_jan_profile_ids(db: Session) -> list[uuid.UUID]:
    """Profiles that should receive Jan-only planning reminders.

    Prefer an exact email / name match. If none exist yet (fresh prod before
    Jan's account is linked), fall back to every active AC so the reminder is
    not silently dropped — better a duplicate than a missed planning window.
    """
    matched: list[uuid.UUID] = []
    for profile in db.scalars(select(Profile).where(Profile.status == "active")):
        if is_jan(profile):
            matched.append(profile.id)
    if matched:
        return matched

    ac_ids = db.scalars(
        select(UserRoleAssignment.user_id)
        .join(Role, Role.id == UserRoleAssignment.role_id)
        .where(Role.slug == "ac")
    ).all()
    return list(dict.fromkeys(ac_ids))
