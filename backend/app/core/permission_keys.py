"""Canonical permission keys for L2 Hub authorization.

Routes and UI must reference these keys — never invent ad-hoc role string checks
for new capability gates.
"""

from typing import Final

# users
USERS_VIEW: Final = "users.view"
USERS_MANAGE: Final = "users.manage"

# roles
ROLES_VIEW: Final = "roles.view"
ROLES_MANAGE: Final = "roles.manage"
ROLES_ASSIGN: Final = "roles.assign"

# committees
COMMITTEES_VIEW: Final = "committees.view"
COMMITTEES_MANAGE: Final = "committees.manage"
COMMITTEES_VIEW_MEMBERS: Final = "committees.view_members"
COMMITTEES_MANAGE_MEMBERS: Final = "committees.manage_members"

# events
EVENTS_VIEW: Final = "events.view"
EVENTS_CREATE: Final = "events.create"
EVENTS_EDIT: Final = "events.edit"
EVENTS_DELETE: Final = "events.delete"

# tasks
TASKS_VIEW_OWN: Final = "tasks.view_own"
TASKS_VIEW_COMMITTEE: Final = "tasks.view_committee"
TASKS_MANAGE_COMMITTEE: Final = "tasks.manage_committee"
TASKS_VIEW_ALL: Final = "tasks.view_all"
TASKS_MANAGE_ALL: Final = "tasks.manage_all"

# cross-committee requests
# The ladder mirrors tasks: a member works inside their own committee, and
# only leadership sees every committee's traffic at once.
REQUESTS_VIEW_OWN_COMMITTEE: Final = "requests.view_own_committee"
REQUESTS_CREATE: Final = "requests.create"
REQUESTS_MANAGE_OWN_COMMITTEE: Final = "requests.manage_own_committee"
REQUESTS_VIEW_ALL: Final = "requests.view_all"
#: Answering for a committee you are not in, and filing in its name. Held by
#: platform ops only — a committee head runs one committee, not all of them.
REQUESTS_MANAGE_ALL: Final = "requests.manage_all"

# debrief
DEBRIEF_SUBMIT: Final = "debrief.submit"
DEBRIEF_VIEW_OWN: Final = "debrief.view_own"
DEBRIEF_VIEW_COMMITTEE: Final = "debrief.view_committee"
DEBRIEF_VIEW_ALL: Final = "debrief.view_all"
DEBRIEF_START: Final = "debrief.start"
DEBRIEF_END: Final = "debrief.end"
DEBRIEF_REOPEN: Final = "debrief.reopen"

# attendance
ATTENDANCE_VIEW_COMMITTEE: Final = "attendance.view_committee"
ATTENDANCE_MANAGE_COMMITTEE: Final = "attendance.manage_committee"
ATTENDANCE_VIEW_ALL: Final = "attendance.view_all"
ATTENDANCE_MANAGE_ALL: Final = "attendance.manage_all"

# grades
# Workflow: Jan and Jadon (gradebook operators) grade, approve, edit rubrics,
# and publish. Heads send draft assignment requests and enter class-wide
# committee grades (separate category) via grades.grade_committee.
# grades.edit is legacy and grants nothing — keep for older role rows.
GRADES_VIEW_OWN: Final = "grades.view_own"
GRADES_VIEW_COMMITTEE: Final = "grades.view_committee"
GRADES_VIEW_ALL: Final = "grades.view_all"
GRADES_EDIT: Final = "grades.edit"
GRADES_ASSIGN: Final = "grades.assign"
GRADES_GRADE_COMMITTEE: Final = "grades.grade_committee"
GRADES_PUBLISH: Final = "grades.publish"
GRADES_REQUEST_ASSIGNMENT: Final = "grades.request_assignment"

# agenda
AGENDA_VIEW_COMMITTEE: Final = "agenda.view_committee"
AGENDA_EDIT_COMMITTEE: Final = "agenda.edit_committee"
AGENDA_VIEW_ALL: Final = "agenda.view_all"
AGENDA_EDIT_ALL: Final = "agenda.edit_all"
AGENDA_FINALIZE: Final = "agenda.finalize"
AGENDA_GENERATE: Final = "agenda.generate"

# wrapped
WRAPPED_VIEW_COMMITTEE: Final = "wrapped.view_committee"
WRAPPED_VIEW_ALL: Final = "wrapped.view_all"
WRAPPED_VIEW_PUBLISHED: Final = "wrapped.view_published"
WRAPPED_REQUEST: Final = "wrapped.request"
WRAPPED_APPROVE: Final = "wrapped.approve"
WRAPPED_GENERATE: Final = "wrapped.generate"
WRAPPED_EDIT: Final = "wrapped.edit"
WRAPPED_PUBLISH: Final = "wrapped.publish"
WRAPPED_PRESENT: Final = "wrapped.present"

# notifications
NOTIFICATIONS_VIEW_OWN: Final = "notifications.view_own"

# materials
MATERIALS_VIEW_COMMITTEE: Final = "materials.view_committee"
MATERIALS_MANAGE_COMMITTEE: Final = "materials.manage_committee"
MATERIALS_VIEW_ALL: Final = "materials.view_all"
MATERIALS_MANAGE_ALL: Final = "materials.manage_all"

# feedback — AC only
FEEDBACK_VIEW_PRIVATE: Final = "feedback.view_private"
FEEDBACK_VIEW_ANONYMOUS: Final = "feedback.view_anonymous"
FEEDBACK_MANAGE: Final = "feedback.manage"

# knowledge
KNOWLEDGE_VIEW: Final = "knowledge.view"
KNOWLEDGE_UPLOAD: Final = "knowledge.upload"
KNOWLEDGE_MANAGE: Final = "knowledge.manage"

# event planning
PLANNING_VIEW: Final = "planning.view"
PLANNING_CREATE: Final = "planning.create"
PLANNING_ASSIGN: Final = "planning.assign"
PLANNING_ENABLE: Final = "planning.enable"

# settings
# Distinct from admin.settings, which covers platform configuration. These
# two gate the Campsite settings screens: view is granted to advisers so they
# can read the configuration without being able to change it.
SETTINGS_VIEW: Final = "settings.view"
SETTINGS_EDIT: Final = "settings.edit"

# class officers platform
CLASS_OFFICERS_VIEW: Final = "class_officers.view"
CLASS_OFFICERS_MANAGE: Final = "class_officers.manage"

# note taker (Otter-style meeting capture)
NOTE_TAKER_VIEW: Final = "note_taker.view"
NOTE_TAKER_RECORD: Final = "note_taker.record"
NOTE_TAKER_MANAGE: Final = "note_taker.manage"

# messenger agenda (keyword-triggered chat → meeting agenda)
MESSENGER_AGENDA_VIEW: Final = "messenger_agenda.view"
MESSENGER_AGENDA_INGEST: Final = "messenger_agenda.ingest"
MESSENGER_AGENDA_MANAGE: Final = "messenger_agenda.manage"

# admin
ADMIN_SETTINGS: Final = "admin.settings"
ADMIN_AUDIT: Final = "admin.audit"
ADMIN_PREVIEW_USER: Final = "admin.preview_user"

PERMISSION_CATALOG: Final[tuple[tuple[str, str, str], ...]] = (
    (USERS_VIEW, "View user roster", "users"),
    (USERS_MANAGE, "Create, invite, deactivate users", "users"),
    (ROLES_VIEW, "View roles and assignments", "roles"),
    (ROLES_MANAGE, "Edit role definitions", "roles"),
    (ROLES_ASSIGN, "Assign or remove roles", "roles"),
    (COMMITTEES_VIEW, "View committees", "committees"),
    (COMMITTEES_MANAGE, "Manage committees", "committees"),
    (COMMITTEES_VIEW_MEMBERS, "View committee members", "committees"),
    (COMMITTEES_MANAGE_MEMBERS, "Manage committee membership", "committees"),
    (EVENTS_VIEW, "View events", "events"),
    (EVENTS_CREATE, "Create events", "events"),
    (EVENTS_EDIT, "Edit events", "events"),
    (EVENTS_DELETE, "Delete events", "events"),
    (TASKS_VIEW_OWN, "View own tasks", "tasks"),
    (TASKS_VIEW_COMMITTEE, "View committee tasks", "tasks"),
    (TASKS_MANAGE_COMMITTEE, "Manage committee tasks", "tasks"),
    (TASKS_VIEW_ALL, "View all tasks", "tasks"),
    (TASKS_MANAGE_ALL, "Manage all tasks", "tasks"),
    (REQUESTS_VIEW_OWN_COMMITTEE, "View own committee's requests", "requests"),
    (REQUESTS_CREATE, "File a request to another committee", "requests"),
    (
        REQUESTS_MANAGE_OWN_COMMITTEE,
        "Accept or complete requests sent to own committee",
        "requests",
    ),
    (REQUESTS_VIEW_ALL, "View every committee's requests", "requests"),
    (REQUESTS_MANAGE_ALL, "File and answer requests for any committee", "requests"),
    (DEBRIEF_SUBMIT, "Submit own debrief", "debrief"),
    (DEBRIEF_VIEW_OWN, "View own debrief submissions", "debrief"),
    (DEBRIEF_VIEW_COMMITTEE, "View committee debriefs", "debrief"),
    (DEBRIEF_VIEW_ALL, "View all debriefs", "debrief"),
    (DEBRIEF_START, "Start debrief sessions", "debrief"),
    (DEBRIEF_END, "End debrief sessions", "debrief"),
    (DEBRIEF_REOPEN, "Reopen debrief sessions", "debrief"),
    (ATTENDANCE_VIEW_COMMITTEE, "View committee attendance", "attendance"),
    (ATTENDANCE_MANAGE_COMMITTEE, "Manage committee attendance", "attendance"),
    (ATTENDANCE_VIEW_ALL, "View all attendance", "attendance"),
    (ATTENDANCE_MANAGE_ALL, "Manage all attendance", "attendance"),
    (GRADES_VIEW_OWN, "View own grades", "grades"),
    (GRADES_VIEW_COMMITTEE, "View committee grades", "grades"),
    (GRADES_VIEW_ALL, "View all grades", "grades"),
    (
        GRADES_EDIT,
        "Legacy grade edit (unused — prefer grades.grade_committee)",
        "grades",
    ),
    (GRADES_ASSIGN, "Create and configure gradebook assignments", "grades"),
    (
        GRADES_GRADE_COMMITTEE,
        "Enter committee-category grades for the class (heads: own committee)",
        "grades",
    ),
    (GRADES_PUBLISH, "Publish grades so students can see them", "grades"),
    (
        GRADES_REQUEST_ASSIGNMENT,
        "Send draft assignment requests to Jan for approval",
        "grades",
    ),
    (AGENDA_VIEW_COMMITTEE, "View committee agendas", "agenda"),
    (AGENDA_EDIT_COMMITTEE, "Edit committee agendas", "agenda"),
    (AGENDA_VIEW_ALL, "View all agendas", "agenda"),
    (AGENDA_EDIT_ALL, "Edit all agendas", "agenda"),
    (AGENDA_FINALIZE, "Finalize agendas", "agenda"),
    (AGENDA_GENERATE, "Generate leadership agendas from Wrapped", "agenda"),
    (WRAPPED_VIEW_COMMITTEE, "View committee Wrapped reports", "wrapped"),
    (WRAPPED_VIEW_ALL, "View all Wrapped reports", "wrapped"),
    (WRAPPED_VIEW_PUBLISHED, "View published Event Wrapped reports", "wrapped"),
    (WRAPPED_REQUEST, "Request Event Summary generation", "wrapped"),
    (WRAPPED_APPROVE, "Approve or reject Event Summary requests", "wrapped"),
    (WRAPPED_GENERATE, "Activate or regenerate Event Summaries", "wrapped"),
    (WRAPPED_EDIT, "Edit Event Summary content", "wrapped"),
    (WRAPPED_PUBLISH, "Publish Wrapped reports", "wrapped"),
    (WRAPPED_PRESENT, "Mark Event Wrapped as presented to the class", "wrapped"),
    (MATERIALS_VIEW_COMMITTEE, "View committee materials", "materials"),
    (MATERIALS_MANAGE_COMMITTEE, "Manage committee materials", "materials"),
    (MATERIALS_VIEW_ALL, "View all materials", "materials"),
    (MATERIALS_MANAGE_ALL, "Manage all materials", "materials"),
    (FEEDBACK_VIEW_PRIVATE, "View private feedback", "feedback"),
    (FEEDBACK_VIEW_ANONYMOUS, "View anonymous feedback", "feedback"),
    (FEEDBACK_MANAGE, "Manage feedback workflows", "feedback"),
    (KNOWLEDGE_VIEW, "View knowledge documents", "knowledge"),
    (KNOWLEDGE_UPLOAD, "Upload knowledge documents", "knowledge"),
    (KNOWLEDGE_MANAGE, "Manage knowledge documents", "knowledge"),
    (PLANNING_VIEW, "View event planning boards", "planning"),
    (PLANNING_CREATE, "Create event planning requests", "planning"),
    (PLANNING_ASSIGN, "Assign committees or members to plans", "planning"),
    (PLANNING_ENABLE, "Enable event planning before assignees accept", "planning"),
    (CLASS_OFFICERS_VIEW, "View the Class Officers platform", "class_officers"),
    (
        CLASS_OFFICERS_MANAGE,
        "Edit Class Officers fundraiser and homecoming plans",
        "class_officers",
    ),
    (NOTE_TAKER_VIEW, "View own Note Taker meeting sessions", "note_taker"),
    (NOTE_TAKER_RECORD, "Record and upload Note Taker sessions", "note_taker"),
    (NOTE_TAKER_MANAGE, "View any Note Taker session", "note_taker"),
    (
        MESSENGER_AGENDA_VIEW,
        "View own Messenger Agenda sessions",
        "messenger_agenda",
    ),
    (
        MESSENGER_AGENDA_INGEST,
        "Connect Messenger chats and capture agendas",
        "messenger_agenda",
    ),
    (
        MESSENGER_AGENDA_MANAGE,
        "View any Messenger Agenda session",
        "messenger_agenda",
    ),
    (NOTIFICATIONS_VIEW_OWN, "View own notifications", "notifications"),
    (SETTINGS_VIEW, "View Campsite settings", "admin"),
    (SETTINGS_EDIT, "Edit Campsite settings", "admin"),
    (ADMIN_SETTINGS, "Configure platform settings", "admin"),
    (ADMIN_AUDIT, "View audit logs", "admin"),
    (ADMIN_PREVIEW_USER, "Preview another user's dashboard", "admin"),
)

ALL_PERMISSION_KEYS: Final[frozenset[str]] = frozenset(key for key, _, _ in PERMISSION_CATALOG)

# Permissions that only apply to the caller's own resources.
SELF_SCOPED_PERMISSIONS: Final[frozenset[str]] = frozenset(
    {
        TASKS_VIEW_OWN,
        DEBRIEF_SUBMIT,
        DEBRIEF_VIEW_OWN,
        GRADES_VIEW_OWN,
        NOTE_TAKER_VIEW,
        NOTE_TAKER_RECORD,
        MESSENGER_AGENDA_VIEW,
        MESSENGER_AGENDA_INGEST,
    }
)

# Permissions that require a matching committee assignment / headship.
COMMITTEE_SCOPED_PERMISSIONS: Final[frozenset[str]] = frozenset(
    {
        TASKS_VIEW_COMMITTEE,
        TASKS_MANAGE_COMMITTEE,
        REQUESTS_VIEW_OWN_COMMITTEE,
        REQUESTS_MANAGE_OWN_COMMITTEE,
        DEBRIEF_VIEW_COMMITTEE,
        ATTENDANCE_VIEW_COMMITTEE,
        ATTENDANCE_MANAGE_COMMITTEE,
        AGENDA_VIEW_COMMITTEE,
        AGENDA_EDIT_COMMITTEE,
        WRAPPED_VIEW_COMMITTEE,
        MATERIALS_VIEW_COMMITTEE,
        MATERIALS_MANAGE_COMMITTEE,
        COMMITTEES_VIEW_MEMBERS,
        COMMITTEES_MANAGE_MEMBERS,
        GRADES_VIEW_COMMITTEE,
        GRADES_GRADE_COMMITTEE,
        GRADES_REQUEST_ASSIGNMENT,
    }
)

FEEDBACK_PERMISSIONS: Final[frozenset[str]] = frozenset(
    {
        FEEDBACK_VIEW_PRIVATE,
        FEEDBACK_VIEW_ANONYMOUS,
        FEEDBACK_MANAGE,
    }
)
