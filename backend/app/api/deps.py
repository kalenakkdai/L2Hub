import secrets
import uuid
from collections.abc import Callable
from typing import Annotated

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session, selectinload

from app.core import permissions
from app.core.config import settings
from app.core.security import AuthConfigurationError, AuthError, verify_token
from app.db.session import get_db
from app.mail.factory import get_email_sender_singleton
from app.mail.protocol import EmailSender
from app.models.profile import Profile
from app.models.rbac import CommitteeMembership, UserRoleAssignment
from app.services import authorization as authz
from app.storage.factory import get_storage_singleton
from app.storage.protocol import ObjectStorage

bearer_scheme = HTTPBearer(auto_error=False)

DbSession = Annotated[Session, Depends(get_db)]
BearerToken = Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)]


def get_storage() -> ObjectStorage:
    """Inject the configured object store (local folder today; S3/GCS later)."""
    return get_storage_singleton()


Storage = Annotated[ObjectStorage, Depends(get_storage)]


def get_email_sender() -> EmailSender:
    """Inject the configured email sender (logging by default)."""
    return get_email_sender_singleton()


EmailSenderDep = Annotated[EmailSender, Depends(get_email_sender)]


def require_job_secret(
    x_l2hub_job_secret: Annotated[str | None, Header(alias="X-L2Hub-Job-Secret")] = None,
) -> None:
    """Guard for endpoints a scheduler calls, not a person.

    Deliberately not on the bearer-token path. The caller is pg_cron by way
    of pg_net, which has no user and cannot mint or refresh a Supabase JWT;
    the only way to satisfy `get_current_profile` would be to bake a
    long-lived token for a real student into the database and let every
    scheduled action carry their name.

    An unset secret is a 503, never an open door — a server that was never
    configured for scheduled work should say so rather than run it.
    """
    expected = settings.job_trigger_secret
    if not expected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Scheduled jobs are not configured on this server.",
        )
    # Compared as bytes: compare_digest raises TypeError on non-ASCII str,
    # and this value arrives in a header anyone can set.
    supplied = (x_l2hub_job_secret or "").encode("utf-8", "ignore")
    if not secrets.compare_digest(supplied, expected.encode("utf-8", "ignore")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid job credentials.",
        )


JobAuth = Annotated[None, Depends(require_job_secret)]

_UNAUTHENTICATED = {"WWW-Authenticate": "Bearer"}


def get_token_claims(credentials: BearerToken) -> dict:
    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token.",
            headers=_UNAUTHENTICATED,
        )

    try:
        return verify_token(credentials.credentials)
    except AuthError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
            headers=_UNAUTHENTICATED,
        ) from exc
    except AuthConfigurationError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication is not configured on this server.",
        ) from exc


TokenClaims = Annotated[dict, Depends(get_token_claims)]


def get_current_profile(claims: TokenClaims, db: DbSession) -> Profile:
    try:
        user_id = uuid.UUID(claims["sub"])
    except (KeyError, ValueError, TypeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token subject is not a valid user id.",
            headers=_UNAUTHENTICATED,
        ) from exc

    profile = db.get(
        Profile,
        user_id,
        options=(
            selectinload(Profile.role_assignments).selectinload(UserRoleAssignment.role),
            selectinload(Profile.role_assignments).selectinload(
                UserRoleAssignment.committee
            ),
            selectinload(Profile.committee_memberships).selectinload(
                CommitteeMembership.committee
            ),
            selectinload(Profile.permission_overrides),
        ),
    )

    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No profile exists for this user.",
        )

    return profile


CurrentProfile = Annotated[Profile, Depends(get_current_profile)]


def _forbidden(detail: str | dict) -> HTTPException:
    return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


def require_roles(*allowed: str) -> Callable[..., Profile]:
    allowed_normalized = frozenset(permissions.normalize_role(role) for role in allowed)

    def dependency(profile: CurrentProfile, db: DbSession) -> Profile:
        roles = {
            role["slug"] for role in authz.build_auth_context(db, profile).roles
        }
        if roles.isdisjoint(allowed_normalized):
            raise _forbidden(
                {
                    "code": "permission_denied",
                    "message": "You do not have permission to access this resource.",
                }
            )
        return profile

    return dependency


def require_min_role(minimum: str) -> Callable[..., Profile]:
    def dependency(profile: CurrentProfile, db: DbSession) -> Profile:
        try:
            minimum_rank = permissions.rank(minimum)
            permitted = authz.highest_role_rank(
                authz.build_auth_context(db, profile)
            ) >= minimum_rank
        except ValueError as exc:
            raise _forbidden(
                {
                    "code": "permission_denied",
                    "message": "Your account role is not recognised by this server.",
                }
            ) from exc

        if not permitted:
            raise _forbidden(
                {
                    "code": "permission_denied",
                    "message": "You do not have permission to access this resource.",
                }
            )
        return profile

    return dependency


def require_permission(
    permission: str,
    *,
    committee_id_param: str | None = None,
) -> Callable[..., Profile]:
    """FastAPI dependency factory for permission-key checks.

    If `committee_id_param` is set, the matching path/query value is used as
    the committee scope for the check.
    """

    def dependency(
        profile: CurrentProfile,
        db: DbSession,
        committee_id: uuid.UUID | None = None,
    ) -> Profile:
        scoped_committee = committee_id
        authz.require_permission(
            db,
            profile,
            permission,
            committee_id=scoped_committee,
        )
        return profile

    return dependency


require_staff = require_roles(*sorted(permissions.STAFF_ROLES))
require_leadership = require_roles(*sorted(permissions.LEADERSHIP_ROLES))

StaffProfile = Annotated[Profile, Depends(require_staff)]
LeadershipProfile = Annotated[Profile, Depends(require_leadership)]
