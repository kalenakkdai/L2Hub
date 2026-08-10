"""Protected system roles and default permission bundles.

Hierarchy ranks (higher = more privileged):
  PRESIDENT = 100, AC = 100, ASBO = 80, COMMITTEE_HEAD = 50,
  CLASS_OFFICER = 25, CLASS_ADVISOR = 20, MEMBER = 10

President and AC are peer super-admins with identical permission bundles.
"""

from typing import Final

from app.core import permission_keys as pk

ROLE_PRESIDENT: Final = "president"
ROLE_AC: Final = "ac"
ROLE_ASBO: Final = "asbo"
ROLE_COMMITTEE_HEAD: Final = "committee_head"
ROLE_CLASS_OFFICER: Final = "class_officer"
ROLE_CLASS_ADVISOR: Final = "class_advisor"
ROLE_MEMBER: Final = "member"

SYSTEM_ROLES: Final[tuple[tuple[str, str, int, bool], ...]] = (
    ("President", ROLE_PRESIDENT, 100, False),
    ("AC", ROLE_AC, 100, False),
    ("ASBO", ROLE_ASBO, 80, True),
    ("Committee Head", ROLE_COMMITTEE_HEAD, 50, True),
    ("Class Officer", ROLE_CLASS_OFFICER, 25, True),
    ("Class Advisor", ROLE_CLASS_ADVISOR, 20, True),
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
        pk.NOTE_TAKER_VIEW,
        pk.NOTE_TAKER_RECORD,
        # Everyone reads the L2 Board and the request log: the point of both is
        # that the whole class can see what each committee is up to and who is
        # waiting on whom.
        #
        # Reading is not writing. A camper still only adds tasks to, and
        # answers requests sent to, the committees they are actually in — that
        # is tasks.manage_committee and requests.manage_own_committee below,
        # both committee-scoped.
        pk.TASKS_VIEW_ALL,
        pk.REQUESTS_VIEW_ALL,
        pk.REQUESTS_VIEW_OWN_COMMITTEE,
        pk.REQUESTS_CREATE,
        pk.REQUESTS_MANAGE_OWN_COMMITTEE,
    }
)

# Faculty advisors watch Class Officers progress only. notifications.view_own
# keeps the AppShell bell from 403ing.
CLASS_ADVISOR_PERMISSIONS: Final[frozenset[str]] = frozenset(
    {
        pk.CLASS_OFFICERS_VIEW,
        pk.NOTIFICATIONS_VIEW_OWN,
    }
)

CLASS_OFFICER_PERMISSIONS: Final[frozenset[str]] = frozenset(
    {
        *MEMBER_PERMISSIONS,
        pk.CLASS_OFFICERS_VIEW,
        pk.CLASS_OFFICERS_MANAGE,
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
        # Heads enter scores for their crew; Jan publishes before students see them.
        pk.GRADES_VIEW_COMMITTEE,
        pk.GRADES_GRADE_COMMITTEE,
        # tasks.view_all and requests.view_all arrive with the member baseline;
        # a head reads the board like everyone else and writes to the committee
        # they actually head.
        *MEMBER_PERMISSIONS,
    }
)

# Platform-wide ops. ASBOs may view Campers, both Class Officers workspaces,
# and enable event planning. Still no private/anonymous feedback, role admin,
# grade assign/publish, Wrapped approve/publish, or AC-only settings.
ASBO_DENIED: Final[frozenset[str]] = frozenset(
    {
        *pk.FEEDBACK_PERMISSIONS,
        pk.ADMIN_SETTINGS,
        pk.ADMIN_AUDIT,
        pk.ADMIN_PREVIEW_USER,
        pk.ROLES_MANAGE,
        pk.ROLES_ASSIGN,
        pk.USERS_MANAGE,
        pk.GRADES_EDIT,
        pk.GRADES_ASSIGN,
        pk.GRADES_GRADE_COMMITTEE,
        pk.GRADES_PUBLISH,
        pk.WRAPPED_APPROVE,
        pk.WRAPPED_GENERATE,
        pk.WRAPPED_EDIT,
        pk.WRAPPED_PUBLISH,
        pk.AGENDA_GENERATE,
        pk.AGENDA_FINALIZE,
        pk.AGENDA_EDIT_ALL,
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
    ROLE_CLASS_ADVISOR: CLASS_ADVISOR_PERMISSIONS,
    ROLE_CLASS_OFFICER: CLASS_OFFICER_PERMISSIONS,
    ROLE_COMMITTEE_HEAD: COMMITTEE_HEAD_PERMISSIONS,
    ROLE_ASBO: ASBO_PERMISSIONS,
    ROLE_AC: AC_PERMISSIONS,
    ROLE_PRESIDENT: PRESIDENT_PERMISSIONS,
}
