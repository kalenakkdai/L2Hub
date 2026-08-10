"""Protected grade endpoints.

Persistence is still a stub; the routes exist so the assign → head-grade →
Jan-publish permission matrix can be exercised and the UI can wire against
real keys.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.api.deps import CurrentProfile, DbSession
from app.core import permission_keys as pk
from app.services import authorization as authz

router = APIRouter(prefix="/grades", tags=["grades"])


class PublishBody(BaseModel):
    entry_ids: list[uuid.UUID] = Field(default_factory=list, alias="entryIds")

    model_config = {"populate_by_name": True}


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
        # Students only ever see published rows once the store is live.
        "visibility": "published_only",
    }


@router.get("/all")
def read_all_grades(profile: CurrentProfile, db: DbSession) -> dict:
    authz.require_permission(db, profile, pk.GRADES_VIEW_ALL)
    return {"entries": [], "scope": "all"}


@router.get("/pending")
def read_pending_grades(profile: CurrentProfile, db: DbSession) -> dict:
    """Scores heads have entered that are waiting for Jan to publish."""
    authz.require_permission(db, profile, pk.GRADES_PUBLISH)
    return {"entries": [], "scope": "pending_publish"}


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


@router.post("/assignments", status_code=201)
def create_assignment(profile: CurrentProfile, db: DbSession) -> dict:
    """Jan configures gradebook items. Body is accepted once the store lands."""
    authz.require_permission(db, profile, pk.GRADES_ASSIGN)
    return {"ok": True, "assignment": None}


@router.post("/entries/{entry_id}/grade")
def grade_entry(
    entry_id: uuid.UUID,
    profile: CurrentProfile,
    db: DbSession,
    committee_id: uuid.UUID | None = None,
) -> dict:
    """Heads enter a score; the entry stays unpublished until Jan releases it."""
    ctx = authz.build_auth_context(db, profile)
    scoped = committee_id
    if scoped is None and len(ctx.headed_committee_ids) == 1:
        scoped = next(iter(ctx.headed_committee_ids))
    if scoped is None:
        from fastapi import HTTPException
        from fastapi import status as http_status

        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="committeeId is required when grading for more than one committee.",
        )
    authz.require_permission(
        db, profile, pk.GRADES_GRADE_COMMITTEE, committee_id=scoped
    )
    return {
        "ok": True,
        "entryId": str(entry_id),
        "committeeId": str(scoped),
        "publicationStatus": "pending_publish",
    }


@router.post("/publish")
def publish_grades(body: PublishBody, profile: CurrentProfile, db: DbSession) -> dict:
    """Jan releases head-entered scores so students can see them."""
    authz.require_permission(db, profile, pk.GRADES_PUBLISH)
    return {
        "ok": True,
        "publishedCount": len(body.entry_ids),
        "entryIds": [str(i) for i in body.entry_ids],
    }
