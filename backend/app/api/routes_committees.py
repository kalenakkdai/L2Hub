"""Committee-scoped operational endpoints."""

from __future__ import annotations

import uuid

from fastapi import APIRouter
from sqlalchemy import select

from app.api.deps import CurrentProfile, DbSession
from app.core import permission_keys as pk
from app.models import Committee
from app.services import authorization as authz

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
    return {
        "committee_id": str(committee.id),
        "committee_slug": committee.slug,
        "tasks": [],
    }
