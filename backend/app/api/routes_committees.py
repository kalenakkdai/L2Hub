"""Committee-scoped operational endpoints."""

from __future__ import annotations

import uuid

from fastapi import APIRouter
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import CurrentProfile, DbSession
from app.core import permission_keys as pk
from app.models import Committee
from app.models.work import Task
from app.services import authorization as authz
from app.services import committees as committee_service
from app.services import work

router = APIRouter(prefix="/committees", tags=["committees"])


def _resolve_committee(db: DbSession, committee_ref: str) -> Committee:
    try:
        committee_id = uuid.UUID(committee_ref)
        committee = db.get(Committee, committee_id)
    except ValueError:
        committee = db.scalar(select(Committee).where(Committee.slug == committee_ref))
    if committee is None:
        # Do not leak whether an id exists beyond not-found for unknown slugs;
        # still 404 for missing committees.
        from fastapi import HTTPException, status

        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Committee not found.")
    return committee


@router.get("/{committee_ref}/tasks")
def read_committee_tasks(
    committee_ref: str, profile: CurrentProfile, db: DbSession
) -> dict:
    committee = _resolve_committee(db, committee_ref)
    can_manage = authz.has_permission(
        db, profile, pk.TASKS_MANAGE_COMMITTEE, committee_id=committee.id
    )
    can_view = authz.has_permission(
        db, profile, pk.TASKS_VIEW_COMMITTEE, committee_id=committee.id
    )
    can_view_all = authz.has_permission(db, profile, pk.TASKS_VIEW_ALL)
    if not (can_manage or can_view or can_view_all):
        raise authz.permission_denied(
            code="committee_scope_denied",
            message="You do not have access to this committee.",
        )
    tasks = db.scalars(
        select(Task)
        .options(selectinload(Task.assignee))
        .where(Task.committee_id == committee.id)
        .order_by(Task.due_on.is_(None), Task.due_on, Task.created_at)
    ).all()
    return {
        "committee_id": str(committee.id),
        "committee_slug": committee.slug,
        "tasks": [work.task_payload(task) for task in tasks],
    }


@router.get("/{committee_ref}/members")
def read_committee_members(
    committee_ref: str, profile: CurrentProfile, db: DbSession
) -> dict:
    """Who is in this committee.

    Anyone who can put work on a committee's board must be able to see who
    they can give it to, or the assignee picker is an empty list and
    `create_task`'s membership check is unreachable through the UI.

    Membership is a gate in its own right, not an oversight: a camper can see
    who else is in the committee they are in. It cannot be expressed as a
    permission key, because `has_permission` treats a global grant as
    matching every committee — handing `committees.view_members` to the
    member role would open every roster in the school.
    """
    committee = _resolve_committee(db, committee_ref)
    allowed = (
        authz.has_permission(db, profile, pk.COMMITTEES_VIEW_MEMBERS, committee_id=committee.id)
        or authz.has_permission(
            db, profile, pk.TASKS_MANAGE_COMMITTEE, committee_id=committee.id
        )
        or authz.has_permission(db, profile, pk.TASKS_MANAGE_ALL)
        or committee.id in work.member_committee_ids(profile)
    )
    if not allowed:
        raise authz.permission_denied(
            code="committee_scope_denied",
            message="You do not have access to this committee.",
        )
    return committee_service.roster_payload(db, committee)
