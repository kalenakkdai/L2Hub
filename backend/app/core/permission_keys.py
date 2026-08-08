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
GRADES_VIEW_OWN: Final = "grades.view_own"
GRADES_VIEW_COMMITTEE: Final = "grades.view_committee"
GRADES_VIEW_ALL: Final = "grades.view_all"
GRADES_EDIT: Final = "grades.edit"

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
    (GRADES_EDIT, "Edit grades", "grades"),
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
    (NOTIFICATIONS_VIEW_OWN, "View own notifications", "notifications"),
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
    }
)

# Permissions that require a matching committee assignment / headship.
COMMITTEE_SCOPED_PERMISSIONS: Final[frozenset[str]] = frozenset(
    {
        TASKS_VIEW_COMMITTEE,
        TASKS_MANAGE_COMMITTEE,
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
    }
)

FEEDBACK_PERMISSIONS: Final[frozenset[str]] = frozenset(
    {
        FEEDBACK_VIEW_PRIVATE,
        FEEDBACK_VIEW_ANONYMOUS,
        FEEDBACK_MANAGE,
    }
)
