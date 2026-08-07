"""Protected grade endpoints — authorization only; payload is intentional stub."""

from __future__ import annotations

import uuid

from fastapi import APIRouter

from app.api.deps import CurrentProfile, DbSession
from app.core import permission_keys as pk
from app.services import authorization as authz

router = APIRouter(prefix="/grades", tags=["grades"])


@router.get("/me")
def read_own_grades(profile: CurrentProfile, db: DbSession) -> dict:
    authz.require_permission(
        db,
        profile,
        pk.GRADES_VIEW_OWN,
        resource_owner_id=profile.id,
    )
    return {
        "user_id": str(profile.id),
        "entries": [],
        "summary": {"earnedPoints": 0, "possiblePoints": 0},
    }


@router.get("/all")
def read_all_grades(profile: CurrentProfile, db: DbSession) -> dict:
    authz.require_permission(db, profile, pk.GRADES_VIEW_ALL)
    return {"entries": [], "scope": "all"}


@router.get("/users/{user_id}")
def read_user_grades(
    user_id: uuid.UUID, profile: CurrentProfile, db: DbSession
) -> dict:
    if profile.id == user_id:
        authz.require_permission(
            db,
            profile,
            pk.GRADES_VIEW_OWN,
            resource_owner_id=user_id,
        )
    else:
        # Another student's grades require org-wide grade access.
        authz.require_permission(db, profile, pk.GRADES_VIEW_ALL)
    return {"user_id": str(user_id), "entries": []}
