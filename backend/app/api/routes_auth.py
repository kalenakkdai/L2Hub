from fastapi import APIRouter

from app.api.deps import CurrentProfile
from app.schemas.auth import CurrentUser

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/me", response_model=CurrentUser)
def read_current_user(profile: CurrentProfile) -> CurrentUser:
    """Return the profile of the caller identified by the Supabase access token."""
    return CurrentUser.model_validate(profile)
