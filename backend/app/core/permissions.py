"""Canonical role hierarchy helpers.

New authorization code should use ``app.services.authorization`` and
permission keys. These helpers validate only the normalized role slugs.
"""

from typing import Final

from app.core.role_catalog import (
    ROLE_AC,
    ROLE_ASBO,
    ROLE_CLASS_ADVISOR,
    ROLE_CLASS_OFFICER,
    ROLE_COMMITTEE_HEAD,
    ROLE_MEMBER,
    ROLE_PRESIDENT,
    ROLE_RANK,
    SUPERADMIN_ROLES,
)

UserRole = str

ROLE_ORDER: Final[tuple[str, ...]] = (
    ROLE_MEMBER,
    ROLE_CLASS_ADVISOR,
    ROLE_CLASS_OFFICER,
    ROLE_COMMITTEE_HEAD,
    ROLE_ASBO,
    ROLE_AC,
    ROLE_PRESIDENT,
)

MEMBER: Final = ROLE_MEMBER
CLASS_ADVISOR: Final = ROLE_CLASS_ADVISOR
CLASS_OFFICER: Final = ROLE_CLASS_OFFICER
COMMITTEE_HEAD: Final = ROLE_COMMITTEE_HEAD
ASBO: Final = ROLE_ASBO
AC: Final = ROLE_AC
PRESIDENT: Final = ROLE_PRESIDENT

STAFF_ROLES: Final[frozenset[str]] = frozenset(
    {ROLE_ASBO, ROLE_AC, ROLE_PRESIDENT}
)
LEADERSHIP_ROLES: Final[frozenset[str]] = frozenset(
    {ROLE_COMMITTEE_HEAD, ROLE_ASBO, ROLE_AC, ROLE_PRESIDENT}
)


def normalize_role(role: str) -> str:
    return role


def is_valid_role(role: str) -> bool:
    return normalize_role(role) in ROLE_RANK


def rank(role: str) -> int:
    normalized = normalize_role(role)
    try:
        return ROLE_RANK[normalized]
    except KeyError:
        raise ValueError(f"Unknown role: {role!r}") from None


def has_at_least(role: str, minimum: str) -> bool:
    return rank(role) >= rank(minimum)


def is_staff(role: str) -> bool:
    return normalize_role(role) in STAFF_ROLES


def is_leadership(role: str) -> bool:
    return normalize_role(role) in LEADERSHIP_ROLES


def is_superadmin(role: str) -> bool:
    return normalize_role(role) in SUPERADMIN_ROLES
