"""Role definitions and authorization helpers.

Roles are ordered least- to most-privileged. The same order is declared in the
`public.user_role` Postgres enum, so `ROLE_ORDER` here and enum comparisons in
SQL agree. Keep the two in sync when adding a role.
"""

from typing import Final, Literal, get_args

UserRole = Literal["student", "committee_head", "officer", "adviser"]

ROLE_ORDER: Final[tuple[UserRole, ...]] = get_args(UserRole)

STUDENT: Final[UserRole] = "student"
COMMITTEE_HEAD: Final[UserRole] = "committee_head"
OFFICER: Final[UserRole] = "officer"
ADVISER: Final[UserRole] = "adviser"

# Roles that may administer the organisation: manage sessions, grade, and read
# the full roster.
STAFF_ROLES: Final[frozenset[UserRole]] = frozenset({OFFICER, ADVISER})

# Roles that lead others. A committee head leads their own committee only, so
# their reach is scoped per-committee rather than organisation-wide. Mirrors
# public.is_staff() in the migration, which likewise excludes committee_head.
LEADERSHIP_ROLES: Final[frozenset[UserRole]] = frozenset(
    {COMMITTEE_HEAD, OFFICER, ADVISER}
)

_RANK: Final[dict[str, int]] = {role: index for index, role in enumerate(ROLE_ORDER)}


def is_valid_role(role: str) -> bool:
    """True when `role` is one of the four known roles."""
    return role in _RANK


def rank(role: str) -> int:
    """Seniority of a role, higher being more privileged.

    Raises:
        ValueError: the role is not recognised.
    """
    try:
        return _RANK[role]
    except KeyError:
        raise ValueError(f"Unknown role: {role!r}") from None


def has_at_least(role: str, minimum: UserRole) -> bool:
    """True when `role` is at least as privileged as `minimum`."""
    return rank(role) >= rank(minimum)


def is_staff(role: str) -> bool:
    """True for roles that administer the organisation."""
    return role in STAFF_ROLES


def is_leadership(role: str) -> bool:
    """True for roles that lead others, including committee heads."""
    return role in LEADERSHIP_ROLES
