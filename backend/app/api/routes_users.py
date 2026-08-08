"""Canonical Users administration API — derived from profiles + assignments."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Query
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import CurrentProfile, DbSession
from app.core import permission_keys as pk
from app.models import CommitteeMembership, Profile, UserRoleAssignment
from app.schemas.auth import (
    CommitteeSummary,
    RoleAssignmentOut,
    UserDetail,
    UserListItem,
    UserListResponse,
)
from app.services import authorization as authz

router = APIRouter(prefix="/admin/users", tags=["admin-users"])


def _role_payload(assignment: UserRoleAssignment) -> RoleAssignmentOut:
    role = assignment.role
    committee_name = assignment.committee.name if assignment.committee else None
    scope = (
        "committee"
        if assignment.committee_id
        else "event"
        if assignment.event_id
        else "global"
    )
    return RoleAssignmentOut(
        slug=role.slug,
        name=role.name,
        rank=role.rank,
        scope=scope,
        committee_id=str(assignment.committee_id) if assignment.committee_id else None,
        event_id=str(assignment.event_id) if assignment.event_id else None,
        committee_name=committee_name,
    )


def _committee_payload(membership: CommitteeMembership) -> CommitteeSummary:
    return CommitteeSummary(
        id=membership.committee.id,
        slug=membership.committee.slug,
        name=membership.committee.name,
        is_head=membership.is_head,
        membership_type=membership.membership_type,
    )


def _list_item(db: DbSession, profile: Profile) -> UserListItem:
    roles = [_role_payload(a) for a in profile.role_assignments if a.role is not None]
    committees = [
        _committee_payload(m)
        for m in profile.committee_memberships
        if m.committee is not None
    ]
    primary_role = authz.primary_role_slug(authz.build_auth_context(db, profile))
    return UserListItem(
        id=profile.id,
        email=profile.email,
        full_name=profile.full_name,
        status=profile.status,
        primary_role=primary_role,
        roles=roles,
        committees=committees,
        last_active_at=profile.last_active_at,
        created_at=profile.created_at,
    )


@router.get("", response_model=UserListResponse)
def list_users(
    profile: CurrentProfile,
    db: DbSession,
    q: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
) -> UserListResponse:
    authz.require_permission(db, profile, pk.USERS_VIEW)

    query = (
        select(Profile)
        .options(
            selectinload(Profile.role_assignments).selectinload(UserRoleAssignment.role),
            selectinload(Profile.role_assignments).selectinload(UserRoleAssignment.committee),
            selectinload(Profile.committee_memberships).selectinload(
                CommitteeMembership.committee
            ),
        )
        .order_by(Profile.email.asc())
    )
    users = list(db.scalars(query).unique())

    items = [_list_item(db, user) for user in users]
    if q:
        needle = q.strip().lower()
        items = [
            item
            for item in items
            if needle in item.email.lower()
            or (item.full_name or "").lower().find(needle) >= 0
        ]
    if status_filter:
        items = [item for item in items if item.status == status_filter]

    return UserListResponse(users=items)


@router.get("/{user_id}", response_model=UserDetail)
def get_user(user_id: uuid.UUID, profile: CurrentProfile, db: DbSession) -> UserDetail:
    authz.require_permission(db, profile, pk.USERS_VIEW)

    user = db.scalar(
        select(Profile)
        .where(Profile.id == user_id)
        .options(
            selectinload(Profile.role_assignments).selectinload(UserRoleAssignment.role),
            selectinload(Profile.role_assignments).selectinload(UserRoleAssignment.committee),
            selectinload(Profile.committee_memberships).selectinload(
                CommitteeMembership.committee
            ),
            selectinload(Profile.permission_overrides),
        )
    )
    if user is None:
        from fastapi import HTTPException, status

        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    base = _list_item(db, user)
    ctx = authz.build_auth_context(db, user)
    roles = base.roles
    return UserDetail(
        **base.model_dump(),
        effective_permissions=sorted(ctx.permissions),
        global_roles=[role for role in roles if role.scope == "global"],
        scoped_roles=[role for role in roles if role.scope != "global"],
    )
