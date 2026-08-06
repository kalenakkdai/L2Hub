import uuid
from collections.abc import Callable, Iterable
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core import permissions
from app.core.permissions import UserRole
from app.core.security import AuthConfigurationError, AuthError, verify_token
from app.db.session import get_db
from app.models.profile import Profile

# auto_error=False so a missing header produces our own 401 with a
# WWW-Authenticate challenge, rather than FastAPI's bare 403.
bearer_scheme = HTTPBearer(auto_error=False)

DbSession = Annotated[Session, Depends(get_db)]
BearerToken = Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)]

_UNAUTHENTICATED = {"WWW-Authenticate": "Bearer"}


def get_token_claims(credentials: BearerToken) -> dict:
    """Verify the bearer token and return its claims."""
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
        # A server-side gap, not a caller mistake — do not imply the token is bad.
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication is not configured on this server.",
        ) from exc


TokenClaims = Annotated[dict, Depends(get_token_claims)]


def get_current_profile(claims: TokenClaims, db: DbSession) -> Profile:
    """Load the profile belonging to the verified token's subject."""
    try:
        user_id = uuid.UUID(claims["sub"])
    except (KeyError, ValueError, TypeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token subject is not a valid user id.",
            headers=_UNAUTHENTICATED,
        ) from exc

    profile = db.get(Profile, user_id)

    if profile is None:
        # The signup trigger should have made this row. Its absence means the
        # migration has not been applied, or the row was deleted by hand.
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No profile exists for this user.",
        )

    return profile


CurrentProfile = Annotated[Profile, Depends(get_current_profile)]


def _forbidden(detail: str) -> HTTPException:
    # 403, not 401: the caller proved who they are, they just lack the role.
    return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


def require_roles(*allowed: UserRole) -> Callable[[Profile], Profile]:
    """Dependency factory admitting only the listed roles.

    Usage:
        @router.get("/roster", dependencies=[Depends(require_roles("officer"))])
    """
    allowed_set: frozenset[str] = frozenset(allowed)

    def dependency(profile: CurrentProfile) -> Profile:
        if profile.role not in allowed_set:
            raise _forbidden(f"Requires one of these roles: {_join(sorted(allowed_set))}.")
        return profile

    return dependency


def require_min_role(minimum: UserRole) -> Callable[[Profile], Profile]:
    """Dependency factory admitting `minimum` and anything more privileged."""

    def dependency(profile: CurrentProfile) -> Profile:
        try:
            permitted = permissions.has_at_least(profile.role, minimum)
        except ValueError as exc:
            # A role in the database that this build does not know about.
            # Fail closed rather than guessing where it sits in the hierarchy.
            raise _forbidden("Your account role is not recognised by this server.") from exc

        if not permitted:
            raise _forbidden(f"Requires the {minimum} role or higher.")
        return profile

    return dependency


def _join(roles: Iterable[str]) -> str:
    return ", ".join(roles)


# Ready-made gates for the common cases.
require_staff = require_roles(*sorted(permissions.STAFF_ROLES))
require_leadership = require_roles(*sorted(permissions.LEADERSHIP_ROLES))

StaffProfile = Annotated[Profile, Depends(require_staff)]
LeadershipProfile = Annotated[Profile, Depends(require_leadership)]
