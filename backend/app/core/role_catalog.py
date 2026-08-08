"""Protected system roles and default permission bundles.

Hierarchy ranks (higher = more privileged):
  PRESIDENT = 100, AC = 100, ASBO = 80, COMMITTEE_HEAD = 50, MEMBER = 10

President and AC are peer super-admins with identical permission bundles.
"""

from typing import Final

from app.core import permission_keys as pk

ROLE_PRESIDENT: Final = "president"
ROLE_AC: Final = "ac"
ROLE_ASBO: Final = "asbo"
ROLE_COMMITTEE_HEAD: Final = "committee_head"
ROLE_MEMBER: Final = "member"

SYSTEM_ROLES: Final[tuple[tuple[str, str, int, bool], ...]] = (
    ("President", ROLE_PRESIDENT, 100, False),
    ("AC", ROLE_AC, 100, False),
    ("ASBO", ROLE_ASBO, 80, True),
    ("Committee Head", ROLE_COMMITTEE_HEAD, 50, True),
    ("Member", ROLE_MEMBER, 10, True),
)

ROLE_RANK: Final[dict[str, int]] = {slug: rank for _, slug, rank, _ in SYSTEM_ROLES}

SUPERADMIN_ROLES: Final[frozenset[str]] = frozenset({ROLE_PRESIDENT, ROLE_AC})

MEMBER_PERMISSIONS: Final[frozenset[str]] = frozenset(
    {
        pk.TASKS_VIEW_OWN,
        pk.EVENTS_VIEW,
        pk.DEBRIEF_SUBMIT,
        pk.DEBRIEF_VIEW_OWN,
        pk.GRADES_VIEW_OWN,
        pk.COMMITTEES_VIEW,
        pk.WRAPPED_VIEW_PUBLISHED,
        pk.NOTIFICATIONS_VIEW_OWN,
        pk.PLANNING_VIEW,
        pk.PLANNING_CREATE,
        pk.PLANNING_ASSIGN,
        pk.KNOWLEDGE_VIEW,
    }
)

COMMITTEE_HEAD_PERMISSIONS: Final[frozenset[str]] = frozenset(
    {
        pk.COMMITTEES_VIEW,
        pk.COMMITTEES_VIEW_MEMBERS,
        pk.TASKS_VIEW_COMMITTEE,
        pk.TASKS_MANAGE_COMMITTEE,
        pk.EVENTS_VIEW,
        pk.DEBRIEF_VIEW_COMMITTEE,
        pk.ATTENDANCE_VIEW_COMMITTEE,
        pk.ATTENDANCE_MANAGE_COMMITTEE,
        pk.AGENDA_VIEW_COMMITTEE,
        pk.AGENDA_EDIT_COMMITTEE,
        pk.WRAPPED_VIEW_COMMITTEE,
        pk.WRAPPED_VIEW_PUBLISHED,
        pk.WRAPPED_REQUEST,
        pk.MATERIALS_VIEW_COMMITTEE,
        pk.MATERIALS_MANAGE_COMMITTEE,
        pk.NOTIFICATIONS_VIEW_OWN,
        *MEMBER_PERMISSIONS,
    }
)

# Platform-wide ops. No feedback, no grades.edit, no approve/publish/generate,
# and no planning.enable (AC/Mr. Jan gate only).
ASBO_DENIED: Final[frozenset[str]] = frozenset(
    {
        *pk.FEEDBACK_PERMISSIONS,
        pk.ADMIN_SETTINGS,
        pk.ADMIN_AUDIT,
        pk.ADMIN_PREVIEW_USER,
        pk.ROLES_MANAGE,
        pk.ROLES_ASSIGN,
        pk.USERS_VIEW,
        pk.USERS_MANAGE,
        pk.GRADES_EDIT,
        pk.WRAPPED_APPROVE,
        pk.WRAPPED_GENERATE,
        pk.WRAPPED_EDIT,
        pk.WRAPPED_PUBLISH,
        pk.AGENDA_GENERATE,
        pk.AGENDA_FINALIZE,
        pk.AGENDA_EDIT_ALL,
        pk.PLANNING_ENABLE,
    }
)

ASBO_PERMISSIONS: Final[frozenset[str]] = frozenset(
    {
        *(key for key in pk.ALL_PERMISSION_KEYS if key not in ASBO_DENIED),
        pk.WRAPPED_REQUEST,
        pk.WRAPPED_VIEW_PUBLISHED,
        pk.NOTIFICATIONS_VIEW_OWN,
    }
)

AC_PERMISSIONS: Final[frozenset[str]] = frozenset(pk.ALL_PERMISSION_KEYS)
PRESIDENT_PERMISSIONS: Final[frozenset[str]] = AC_PERMISSIONS

ROLE_PERMISSION_BUNDLES: Final[dict[str, frozenset[str]]] = {
    ROLE_MEMBER: MEMBER_PERMISSIONS,
    ROLE_COMMITTEE_HEAD: COMMITTEE_HEAD_PERMISSIONS,
    ROLE_ASBO: ASBO_PERMISSIONS,
    ROLE_AC: AC_PERMISSIONS,
    ROLE_PRESIDENT: PRESIDENT_PERMISSIONS,
}
