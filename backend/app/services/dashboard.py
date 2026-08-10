"""Dashboard module resolution from effective permissions."""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.core import permission_keys as pk
from app.models.profile import Profile
from app.services.authorization import build_auth_context


@dataclass(frozen=True)
class DashboardModule:
    key: str
    title: str
    required_any: tuple[str, ...]


MODULE_CATALOG: tuple[DashboardModule, ...] = (
    DashboardModule("my_tasks", "My tasks", (pk.TASKS_VIEW_OWN,)),
    DashboardModule("my_events", "My events", (pk.EVENTS_VIEW,)),
    DashboardModule("my_committee", "My committee", (pk.COMMITTEES_VIEW,)),
    DashboardModule("my_submissions", "My submissions", (pk.DEBRIEF_VIEW_OWN,)),
    DashboardModule("my_grades", "My grades", (pk.GRADES_VIEW_OWN,)),
    DashboardModule(
        "committee_members",
        "Committee members",
        (pk.COMMITTEES_VIEW_MEMBERS,),
    ),
    DashboardModule(
        "committee_grading",
        "Committee grading",
        (pk.GRADES_GRADE_COMMITTEE,),
    ),
    DashboardModule(
        "assignment_requests",
        "Assignment requests",
        (pk.GRADES_REQUEST_ASSIGNMENT, pk.GRADES_ASSIGN),
    ),
    DashboardModule(
        "committee_tasks",
        "Committee tasks",
        (pk.TASKS_VIEW_COMMITTEE, pk.TASKS_MANAGE_COMMITTEE),
    ),
    DashboardModule(
        "committee_progress",
        "Committee progress",
        (pk.DEBRIEF_VIEW_COMMITTEE, pk.ATTENDANCE_VIEW_COMMITTEE),
    ),
    DashboardModule(
        "committee_materials",
        "Committee materials",
        (pk.MATERIALS_VIEW_COMMITTEE, pk.MATERIALS_MANAGE_COMMITTEE),
    ),
    DashboardModule("all_events", "All events", (pk.EVENTS_CREATE, pk.EVENTS_EDIT)),
    DashboardModule(
        "live_monitor",
        "Live monitor",
        (pk.DEBRIEF_VIEW_ALL, pk.ATTENDANCE_VIEW_ALL),
    ),
    DashboardModule(
        "gradebook",
        "Gradebook",
        (pk.GRADES_VIEW_ALL, pk.GRADES_ASSIGN, pk.GRADES_PUBLISH),
    ),
    DashboardModule(
        "grade_publish_queue",
        "Publish grades",
        (pk.GRADES_PUBLISH,),
    ),
    DashboardModule(
        "agenda_tools",
        "Agenda tools",
        (pk.AGENDA_VIEW_ALL, pk.AGENDA_EDIT_ALL, pk.AGENDA_FINALIZE),
    ),
    DashboardModule(
        "wrapped_reports",
        "Wrapped reports",
        (pk.WRAPPED_VIEW_ALL, pk.WRAPPED_PUBLISH),
    ),
    DashboardModule(
        "feedback_review",
        "Feedback review",
        (pk.FEEDBACK_VIEW_PRIVATE, pk.FEEDBACK_VIEW_ANONYMOUS, pk.FEEDBACK_MANAGE),
    ),
    DashboardModule("user_management", "User management", (pk.USERS_VIEW, pk.USERS_MANAGE)),
    DashboardModule("role_management", "Role management", (pk.ROLES_VIEW, pk.ROLES_MANAGE)),
    DashboardModule("system_settings", "System settings", (pk.ADMIN_SETTINGS,)),
)


def resolve_dashboard_modules(db: Session, user: Profile) -> list[dict]:
    """Modules unlocked by any matching permission the caller holds.

    Committee-scoped keys are checked against the caller's permission set, not
    `has_permission(..., committee_id=None)` — that helper requires a committee
    id and would hide every committee module from heads.
    """
    ctx = build_auth_context(db, user)
    modules: list[dict] = []
    seen: set[str] = set()
    for module in MODULE_CATALOG:
        if module.key in seen:
            continue
        if any(key in ctx.permissions for key in module.required_any):
            modules.append({"key": module.key, "title": module.title})
            seen.add(module.key)
    return modules


def dashboard_payload(db: Session, user: Profile) -> dict:
    ctx = build_auth_context(db, user)
    return {
        "roles": ctx.roles,
        "permissions": sorted(ctx.permissions),
        "modules": resolve_dashboard_modules(db, user),
    }
