"""Campsite lifecycle endpoints.

These three mutate role assignments, which the database guards. The service
layer holds the ordering and locking that makes them safe; these functions do
authorization and shape the response.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.api.deps import CurrentProfile, DbSession, require_permission
from app.core import permission_keys as pk
from app.services import campsite as campsite_service

router = APIRouter(prefix="/campsite", tags=["campsite"])


class TransferAdminBody(BaseModel):
    to_user_id: uuid.UUID
    #: Keeps the caller's own administrator role, making this a promotion
    #: rather than a hand-over.
    keep_own_role: bool = False


class BreakCampBody(BaseModel):
    confirm_name: str = Field(min_length=1)
    reason: str | None = None


@router.post(
    "/transfer-admin",
    dependencies=[Depends(require_permission(pk.SETTINGS_EDIT))],
)
def transfer_admin(body: TransferAdminBody, profile: CurrentProfile, db: DbSession) -> dict:
    """Hands administration to another camper, assigning before removing."""
    return campsite_service.transfer_admin(
        db,
        profile,
        to_user_id=body.to_user_id,
        keep_own_role=body.keep_own_role,
    )


@router.post("/leave")
def leave_campsite(profile: CurrentProfile, db: DbSession) -> dict:
    """Removes the caller's own roles and committee memberships.

    Needs no permission beyond being signed in — this only ever affects the
    caller. The last administrator is refused, with an explanation.
    """
    return campsite_service.leave_campsite(db, profile)


@router.post(
    "/break-camp",
    dependencies=[Depends(require_permission(pk.SETTINGS_EDIT))],
)
def break_camp(body: BreakCampBody, profile: CurrentProfile, db: DbSession) -> dict:
    """Archives the Campsite. The typed name is re-checked here, not just in the UI."""
    return campsite_service.break_camp(
        db,
        profile,
        confirm_name=body.confirm_name,
        reason=body.reason,
    )
