"""Centralized permission resolution.

Deny-by-default. Explicit DENY overrides ALLOW. Scope must match.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core import permission_keys as pk
from app.core.role_catalog import (
    COMMITTEE_HEAD_PERMISSIONS,
    ROLE_ASBO,
    ROLE_MEMBER,
    ROLE_RANK,
    SUPERADMIN_ROLES,
)
from app.models import (
    PermissionOverride,
    Profile,
    Role,
    UserRoleAssignment,
)

EFFECT_ALLOW = "allow"
EFFECT_DENY = "deny"
EFFECT_INHERIT = "inherit"


@dataclass(frozen=True)
class EffectivePermission:
    key: str
    effect: str
    scopes: frozenset[str] = field(default_factory=frozenset)
    committee_ids: frozenset[uuid.UUID] = field(default_factory=frozenset)


@dataclass
class AuthContext:
    user: Profile
    roles: list[dict]
    permissions: set[str]
    committee_ids: set[uuid.UUID]
    headed_committee_ids: set[uuid.UUID]
    denied: set[str]
    permission_committee_map: dict[str, set[uuid.UUID]]


def role_rank(slug: str) -> int:
    if slug not in ROLE_RANK:
        raise ValueError(f"Unknown role: {slug!r}")
    return ROLE_RANK[slug]


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def _assignment_active(assignment: UserRoleAssignment, now: datetime) -> bool:
    if assignment.starts_at is not None and _as_utc(assignment.starts_at) > now:
        return False
    return not (
        assignment.ends_at is not None and _as_utc(assignment.ends_at) <= now
    )


def _load_user(db: Session, user_id: uuid.UUID) -> Profile | None:
    from app.models import RolePermission

    return db.scalar(
        select(Profile)
        .where(Profile.id == user_id)
        .options(
            selectinload(Profile.role_assignments)
            .selectinload(UserRoleAssignment.role)
            .selectinload(Role.permissions)
            .selectinload(RolePermission.permission),
            selectinload(Profile.role_assignments).selectinload(UserRoleAssignment.committee),
            selectinload(Profile.committee_memberships),
            selectinload(Profile.permission_overrides).selectinload(
                PermissionOverride.permission
            ),
        )
    )


def build_auth_context(db: Session, user: Profile) -> AuthContext:
    now = _utcnow()
    assignments = [a for a in user.role_assignments if _assignment_active(a, now)]

    allowed: set[str] = set()
    denied: set[str] = set()
    permission_committee_map: dict[str, set[uuid.UUID]] = {}
    roles_payload: list[dict] = []

    for assignment in assignments:
        role = assignment.role
        if role is None:
            continue
        roles_payload.append(
            {
                "slug": role.slug,
                "name": role.name,
                "rank": role.rank,
                "committee_id": str(assignment.committee_id) if assignment.committee_id else None,
                "event_id": str(assignment.event_id) if assignment.event_id else None,
                "scope": (
                    "committee"
                    if assignment.committee_id
                    else "event"
                    if assignment.event_id
                    else "global"
                ),
            }
        )
        for link in role.permissions:
            key = link.permission.key
            if link.effect == EFFECT_DENY:
                denied.add(key)
                continue
            if link.effect != EFFECT_ALLOW:
                continue
            if assignment.committee_id is not None:
                permission_committee_map.setdefault(key, set()).add(assignment.committee_id)
                # Committee-scoped role grants only apply in that committee context;
                # still mark the key as possessed so scoped checks can succeed.
                allowed.add(key)
            else:
                allowed.add(key)
                permission_committee_map.setdefault(key, set())  # empty = global

    # Role-level overrides (rare).
    for override in user.permission_overrides:
        key = override.permission.key
        if override.effect == EFFECT_DENY:
            denied.add(key)
        elif override.effect == EFFECT_ALLOW:
            denied.discard(key)
            allowed.add(key)
            if override.committee_id is not None:
                permission_committee_map.setdefault(key, set()).add(override.committee_id)

    # Explicit deny always wins.
    allowed -= denied

    headed = {
        m.committee_id for m in user.committee_memberships if m.is_head
    }
    member_committees = {m.committee_id for m in user.committee_memberships}

    # Baby shadow grants temporarily elevate to head-level committee access.
    from app.services import shadow as shadow_service

    shadow_ids = shadow_service.active_shadow_committee_ids(db, user.id)
    if shadow_ids:
        headed |= shadow_ids
        for key in COMMITTEE_HEAD_PERMISSIONS:
            if key in denied:
                continue
            allowed.add(key)
            permission_committee_map.setdefault(key, set()).update(shadow_ids)

    # Attendance kiosk: only Mr. Jan and Jadon Li (see attendance_operators).
    from app.services.attendance_operators import is_attendance_operator

    if is_attendance_operator(user):
        allowed.add(pk.ATTENDANCE_MANAGE_ALL)
        allowed.add(pk.ATTENDANCE_VIEW_ALL)
        permission_committee_map.setdefault(pk.ATTENDANCE_MANAGE_ALL, set())
        permission_committee_map.setdefault(pk.ATTENDANCE_VIEW_ALL, set())
    else:
        allowed.discard(pk.ATTENDANCE_MANAGE_ALL)

    # Gradebook workflow:
    # - Jan and Jadon only: grade assignments, approve drafts, edit rubrics,
    #   mass-grade, and publish (see gradebook_operators).
    # - Heads: request draft assignments + enter committee-category class grades.
    # - Legacy grades.edit never grants score entry on its own.
    from app.services.gradebook_operators import is_gradebook_operator

    allowed.discard(pk.GRADES_EDIT)

    if headed:
        for committee_id in headed:
            permission_committee_map.setdefault(pk.GRADES_GRADE_COMMITTEE, set()).add(
                committee_id
            )
            permission_committee_map.setdefault(pk.GRADES_VIEW_COMMITTEE, set()).add(
                committee_id
            )
            permission_committee_map.setdefault(
                pk.GRADES_REQUEST_ASSIGNMENT, set()
            ).add(committee_id)
        allowed.add(pk.GRADES_REQUEST_ASSIGNMENT)
    else:
        allowed.discard(pk.GRADES_GRADE_COMMITTEE)
        allowed.discard(pk.GRADES_REQUEST_ASSIGNMENT)

    # Only Jan / Jadon get assign and publish — never the broader AC /
    # President role alone. View-all stays with roles that already have it
    # (ASBO/AC/President); operators also force-add it for the allowlist pair.
    allowed.discard(pk.GRADES_ASSIGN)
    allowed.discard(pk.GRADES_PUBLISH)

    if is_gradebook_operator(user):
        allowed.add(pk.GRADES_ASSIGN)
        allowed.add(pk.GRADES_PUBLISH)
        allowed.add(pk.GRADES_VIEW_ALL)
        allowed.add(pk.GRADES_GRADE_COMMITTEE)
        allowed.add(pk.GRADES_VIEW_COMMITTEE)
        allowed.add(pk.GRADES_REQUEST_ASSIGNMENT)
        # Empty scope set = unrestricted for committee-scoped checks.
        permission_committee_map[pk.GRADES_GRADE_COMMITTEE] = set()
        permission_committee_map[pk.GRADES_VIEW_COMMITTEE] = set()
        permission_committee_map[pk.GRADES_REQUEST_ASSIGNMENT] = set()

    return AuthContext(
        user=user,
        roles=roles_payload,
        permissions=allowed,
        committee_ids=member_committees,
        headed_committee_ids=headed,
        denied=denied,
        permission_committee_map=permission_committee_map,
    )


def get_auth_context(db: Session, user_id: uuid.UUID) -> AuthContext:
    user = _load_user(db, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    return build_auth_context(db, user)


def get_effective_permissions(
    db: Session,
    user: Profile,
    *,
    committee_id: uuid.UUID | None = None,
    event_id: uuid.UUID | None = None,
) -> set[str]:
    """Return permission keys effective for the optional committee/event lens."""
    del event_id  # reserved for future event-scoped grants
    ctx = build_auth_context(db, user)
    if committee_id is None:
        # Global view: include keys the user holds globally or for any committee.
        return set(ctx.permissions)

    result: set[str] = set()
    for key in ctx.permissions:
        scopes = ctx.permission_committee_map.get(key)
        if scopes is None:
            continue
        if len(scopes) == 0 or committee_id in scopes:
            result.add(key)
    return result


def has_permission(
    db: Session,
    user: Profile,
    permission: str,
    *,
    committee_id: uuid.UUID | None = None,
    event_id: uuid.UUID | None = None,
    resource_owner_id: uuid.UUID | None = None,
) -> bool:
    del event_id
    ctx = build_auth_context(db, user)

    if permission in ctx.denied:
        return False
    if permission not in ctx.permissions:
        return False

    if permission in pk.SELF_SCOPED_PERMISSIONS:
        return not (resource_owner_id is not None and resource_owner_id != user.id)

    if permission in pk.COMMITTEE_SCOPED_PERMISSIONS:
        if committee_id is None:
            return False
        scopes = ctx.permission_committee_map.get(permission, set())
        # Global holders (ASBO/AC) have empty scopes set meaning unrestricted.
        if len(scopes) == 0:
            return True
        if committee_id not in scopes:
            return False
        manage_keys = {
            pk.TASKS_MANAGE_COMMITTEE,
            pk.ATTENDANCE_MANAGE_COMMITTEE,
            pk.MATERIALS_MANAGE_COMMITTEE,
            pk.AGENDA_EDIT_COMMITTEE,
            pk.COMMITTEES_MANAGE_MEMBERS,
        }
        if (
            (permission.endswith(".manage_committee") or permission in manage_keys)
            and committee_id not in ctx.headed_committee_ids
            and len(scopes) > 0
        ):
            return committee_id in ctx.headed_committee_ids
        return True

    # Global permission — if it was granted only via a committee-scoped role,
    # require the committee match when a committee_id is supplied.
    scopes = ctx.permission_committee_map.get(permission, set())
    return not (
        committee_id is not None and len(scopes) > 0 and committee_id not in scopes
    )


def permission_denied(
    *,
    code: str = "permission_denied",
    message: str = "You do not have permission to access this resource.",
) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail={"code": code, "message": message},
    )


def require_permission(
    db: Session,
    user: Profile,
    permission: str,
    *,
    committee_id: uuid.UUID | None = None,
    event_id: uuid.UUID | None = None,
    resource_owner_id: uuid.UUID | None = None,
    code: str = "permission_denied",
    message: str = "You do not have permission to access this resource.",
) -> None:
    if not has_permission(
        db,
        user,
        permission,
        committee_id=committee_id,
        event_id=event_id,
        resource_owner_id=resource_owner_id,
    ):
        if (
            permission in pk.COMMITTEE_SCOPED_PERMISSIONS
            and committee_id is not None
            and code == "permission_denied"
        ):
            raise permission_denied(
                code="committee_scope_denied",
                message="You do not have access to this committee.",
            )
        raise permission_denied(code=code, message=message)


def can_access_self(actor: Profile, target_user_id: uuid.UUID) -> bool:
    return actor.id == target_user_id


def can_access_committee(db: Session, actor: Profile, committee_id: uuid.UUID) -> bool:
    ctx = build_auth_context(db, actor)
    slugs = {r["slug"] for r in ctx.roles}
    if SUPERADMIN_ROLES & slugs or ROLE_ASBO in slugs:
        return True
    return committee_id in ctx.committee_ids


def highest_role_rank(ctx: AuthContext) -> int:
    return max((r["rank"] for r in ctx.roles), default=-1)


def primary_role_slug(ctx: AuthContext) -> str:
    """Return the highest active role, defaulting safely to Member.

    The signup trigger guarantees a Member assignment in production. The
    fallback is deny-safe for malformed local/test rows.
    """
    if not ctx.roles:
        return ROLE_MEMBER
    return max(ctx.roles, key=lambda role: (role["rank"], role["slug"]))["slug"]


def can_manage_user(db: Session, actor: Profile, target: Profile) -> bool:
    actor_ctx = build_auth_context(db, actor)
    target_ctx = build_auth_context(db, target)
    if not has_permission(db, actor, pk.USERS_MANAGE) and not has_permission(
        db, actor, pk.ROLES_ASSIGN
    ):
        return False
    return highest_role_rank(actor_ctx) > highest_role_rank(target_ctx)


def can_assign_role(db: Session, actor: Profile, role: Role) -> bool:
    actor_ctx = build_auth_context(db, actor)
    actor_is_superadmin = bool(
        SUPERADMIN_ROLES & {r["slug"] for r in actor_ctx.roles}
    )

    if not has_permission(db, actor, pk.ROLES_ASSIGN) and not actor_is_superadmin:
        return False

    # Only President/AC may assign President or AC.
    if role.slug in SUPERADMIN_ROLES:
        return actor_is_superadmin

    actor_rank = highest_role_rank(actor_ctx)
    if role.rank >= actor_rank:
        return False
    return bool(role.is_assignable or actor_is_superadmin)
