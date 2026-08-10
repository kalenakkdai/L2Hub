from fastapi import APIRouter

from app.api.deps import CurrentProfile, DbSession
from app.schemas.auth import (
    CommitteeMembershipOut,
    CurrentUser,
    DashboardOut,
    RoleAssignmentOut,
    ShadowGrantOut,
)
from app.services import authorization as authz
from app.services import class_cohort as cohort_service
from app.services import shadow as shadow_service
from app.services.dashboard import dashboard_payload

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/me", response_model=CurrentUser)
def read_current_user(profile: CurrentProfile, db: DbSession) -> CurrentUser:
    """Return the caller profile plus effective roles and permissions."""
    ctx = authz.build_auth_context(db, profile)
    shadow_service.expire_stale_grants(db)
    committees = [
        CommitteeMembershipOut(
            id=membership.committee.id,
            name=membership.committee.name,
            is_head=membership.is_head,
            membership_type=membership.membership_type,
        )
        for membership in profile.committee_memberships
        if membership.committee is not None
    ]
    is_baby = any(c.membership_type == "baby" for c in committees)
    active_shadows: list[ShadowGrantOut] = []
    from datetime import UTC, datetime

    from sqlalchemy import select

    from app.models.shadow import ShadowRequest

    now = datetime.now(UTC)
    for row in db.scalars(
        select(ShadowRequest).where(
            ShadowRequest.requester_id == profile.id,
            ShadowRequest.status == "approved",
            ShadowRequest.ends_at.is_not(None),
            ShadowRequest.ends_at > now,
        )
    ).all():
        committee = next((c for c in committees if c.id == row.committee_id), None)
        name = committee.name if committee else "Committee"
        if row.committee_id and row.ends_at:
            active_shadows.append(
                ShadowGrantOut(
                    committee_id=row.committee_id,
                    committee_name=name,
                    ends_at=row.ends_at,
                )
            )

    return CurrentUser(
        id=profile.id,
        email=profile.email,
        full_name=profile.full_name,
        role=authz.primary_role_slug(ctx),
        status=profile.status,
        created_at=profile.created_at,
        roles=[RoleAssignmentOut(**role) for role in ctx.roles],
        permissions=sorted(ctx.permissions),
        committees=committees,
        is_baby=is_baby,
        active_shadows=active_shadows,
        class_cohort=cohort_service.resolve_class_cohort(db, profile),
        can_switch_class_cohort=cohort_service.platform_may_switch_cohort(db, profile),
    )


@router.get("/dashboard", response_model=DashboardOut)
def read_dashboard(profile: CurrentProfile, db: DbSession) -> DashboardOut:
    payload = dashboard_payload(db, profile)
    return DashboardOut(
        roles=[RoleAssignmentOut(**role) for role in payload["roles"]],
        permissions=payload["permissions"],
        modules=payload["modules"],
    )
