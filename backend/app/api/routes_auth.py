from fastapi import APIRouter

from app.api.deps import CurrentProfile, DbSession
from app.schemas.auth import CurrentUser, DashboardOut, RoleAssignmentOut
from app.services import authorization as authz
from app.services.dashboard import dashboard_payload

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/me", response_model=CurrentUser)
def read_current_user(profile: CurrentProfile, db: DbSession) -> CurrentUser:
    """Return the caller profile plus effective roles and permissions."""
    ctx = authz.build_auth_context(db, profile)
    return CurrentUser(
        id=profile.id,
        email=profile.email,
        full_name=profile.full_name,
        role=authz.primary_role_slug(ctx),
        status=getattr(profile, "status", "active") or "active",
        created_at=profile.created_at,
        roles=[RoleAssignmentOut(**role) for role in ctx.roles],
        permissions=sorted(ctx.permissions),
    )


@router.get("/dashboard", response_model=DashboardOut)
def read_dashboard(profile: CurrentProfile, db: DbSession) -> DashboardOut:
    payload = dashboard_payload(db, profile)
    return DashboardOut(
        roles=[RoleAssignmentOut(**role) for role in payload["roles"]],
        permissions=payload["permissions"],
        modules=payload["modules"],
    )
