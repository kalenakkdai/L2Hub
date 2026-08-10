"""Protected grade endpoints.

Persistence is still a stub; the routes exist so the assign → head-grade →
publish permission matrix can be exercised and so Jan ↔ Jadon transparency
notifications fire on every write.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException
from fastapi import status as http_status
from pydantic import BaseModel, Field

from app.api.deps import CurrentProfile, DbSession
from app.core import permission_keys as pk
from app.services import authorization as authz
from app.services import gradebook

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
    """Scores waiting to be published for students."""
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
    """Configure a gradebook item. Jan and Jadon both may do this."""
    authz.require_permission(db, profile, pk.GRADES_ASSIGN)
    gradebook.notify_peer_gradebook_change(
        db,
        profile,
        action="configured an assignment",
        detail="A gradebook assignment was created or updated.",
        payload={"href": "/grades"},
    )
    db.commit()
    return {"ok": True, "assignment": None}


@router.post("/entries/{entry_id}/grade")
def grade_entry(
    entry_id: uuid.UUID,
    profile: CurrentProfile,
    db: DbSession,
    committee_id: uuid.UUID | None = None,
) -> dict:
    """Enter a score. Heads are scoped to their committee; Jan/Jadon are org-wide."""
    ctx = authz.build_auth_context(db, profile)
    scopes = ctx.permission_committee_map.get(pk.GRADES_GRADE_COMMITTEE, set())
    org_wide = pk.GRADES_GRADE_COMMITTEE in ctx.permissions and len(scopes) == 0

    scoped = committee_id
    if org_wide:
        # Jan / Jadon: full control, committee tag optional.
        pass
    elif scoped is None and len(ctx.headed_committee_ids) == 1:
        scoped = next(iter(ctx.headed_committee_ids))
        authz.require_permission(
            db, profile, pk.GRADES_GRADE_COMMITTEE, committee_id=scoped
        )
    elif scoped is not None:
        authz.require_permission(
            db, profile, pk.GRADES_GRADE_COMMITTEE, committee_id=scoped
        )
    else:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="committeeId is required when grading for more than one committee.",
        )

    gradebook.notify_peer_gradebook_change(
        db,
        profile,
        action="entered a grade",
        detail=f"Score saved for entry {entry_id}.",
        payload={"entryId": str(entry_id), "href": "/grades"},
    )
    db.commit()
    return {
        "ok": True,
        "entryId": str(entry_id),
        "committeeId": str(scoped) if scoped else None,
        "publicationStatus": "pending_publish",
    }


@router.post("/publish")
def publish_grades(body: PublishBody, profile: CurrentProfile, db: DbSession) -> dict:
    """Release scores so students can see them. Jan and Jadon both may publish."""
    authz.require_permission(db, profile, pk.GRADES_PUBLISH)
    count = len(body.entry_ids)
    gradebook.notify_peer_gradebook_change(
        db,
        profile,
        action="published grades",
        detail=f"Released {count} grade{'s' if count != 1 else ''} to students.",
        payload={
            "entryIds": [str(i) for i in body.entry_ids],
            "href": "/grades",
        },
    )
    db.commit()
    return {
        "ok": True,
        "publishedCount": count,
        "entryIds": [str(i) for i in body.entry_ids],
    }
