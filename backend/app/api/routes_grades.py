"""Protected grade endpoints.

Persistence is still a stub; the routes exist so the Jan/Jadon operator
matrix, head draft requests, committee-category grades, and mass grading
can be exercised — and so peer transparency notifications fire on writes.
"""

from __future__ import annotations

import uuid
from typing import Literal

from fastapi import APIRouter, HTTPException
from fastapi import status as http_status
from pydantic import BaseModel, Field

from app.api.deps import CurrentProfile, DbSession
from app.core import permission_keys as pk
from app.services import authorization as authz
from app.services import gradebook
from app.services.gradebook_operators import is_gradebook_operator

router = APIRouter(prefix="/grades", tags=["grades"])


class PublishBody(BaseModel):
    entry_ids: list[uuid.UUID] = Field(default_factory=list, alias="entryIds")

    model_config = {"populate_by_name": True}


class BulkGradeItem(BaseModel):
    entry_id: uuid.UUID = Field(alias="entryId")
    score: float | None = None
    status: str | None = None

    model_config = {"populate_by_name": True}


class BulkGradeBody(BaseModel):
    items: list[BulkGradeItem] = Field(default_factory=list)


class AssignmentRequestBody(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = None
    proposed_category_id: str | None = Field(default=None, alias="proposedCategoryId")
    proposed_points: float | None = Field(default=None, alias="proposedPoints")
    committee_id: uuid.UUID | None = Field(default=None, alias="committeeId")

    model_config = {"populate_by_name": True}


class ReviewAssignmentRequestBody(BaseModel):
    decision: Literal["approve", "reject"]
    note: str | None = None


class RubricCriterionBody(BaseModel):
    id: str
    label: str
    points_possible: float = Field(alias="pointsPossible")
    kind: Literal["manual", "on_time"] = "manual"
    description: str | None = None
    is_default: bool | None = Field(default=None, alias="isDefault")

    model_config = {"populate_by_name": True}


class RubricBody(BaseModel):
    criteria: list[RubricCriterionBody] = Field(default_factory=list)


class CommitteeGradeScore(BaseModel):
    student_id: uuid.UUID = Field(alias="studentId")
    score: float

    model_config = {"populate_by_name": True}


class CommitteeGradesBody(BaseModel):
    """Class-wide scores in the Committee grades category (separate from assignments)."""

    committee_id: uuid.UUID = Field(alias="committeeId")
    assignment_title: str | None = Field(default=None, alias="assignmentTitle")
    points_possible: float = Field(default=10, alias="pointsPossible")
    scores: list[CommitteeGradeScore] = Field(default_factory=list)

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
        "categories": [
            {"id": "cat-debriefs", "name": "Event debriefs", "weightPercent": 35},
            {"id": "cat-reflections", "name": "Reflections", "weightPercent": 20},
            {"id": "cat-deliverables", "name": "Deliverables", "weightPercent": 15},
            {"id": "cat-participation", "name": "Participation", "weightPercent": 10},
            {
                "id": "cat-committee-grades",
                "name": "Committee grades",
                "weightPercent": 20,
            },
        ],
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
    """Configure a gradebook item. Jan and Jadon only."""
    authz.require_permission(db, profile, pk.GRADES_ASSIGN)
    if not is_gradebook_operator(profile):
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="Only Jan and Jadon can configure gradebook assignments.",
        )
    gradebook.notify_peer_gradebook_change(
        db,
        profile,
        action="configured an assignment",
        detail="A gradebook assignment was created or updated.",
        payload={"href": "/grades"},
    )
    db.commit()
    return {"ok": True, "assignment": None}


@router.put("/assignments/{assignment_id}/rubric")
def update_assignment_rubric(
    assignment_id: uuid.UUID,
    body: RubricBody,
    profile: CurrentProfile,
    db: DbSession,
) -> dict:
    """Change rubric criteria. Jan and Jadon only."""
    authz.require_permission(db, profile, pk.GRADES_ASSIGN)
    if not is_gradebook_operator(profile):
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="Only Jan and Jadon can change rubrics.",
        )
    gradebook.notify_peer_gradebook_change(
        db,
        profile,
        action="updated a rubric",
        detail=f"Rubric updated for assignment {assignment_id}.",
        payload={"assignmentId": str(assignment_id), "href": "/grades"},
    )
    db.commit()
    return {
        "ok": True,
        "assignmentId": str(assignment_id),
        "criteriaCount": len(body.criteria),
    }


@router.post("/entries/{entry_id}/grade")
def grade_entry(
    entry_id: uuid.UUID,
    profile: CurrentProfile,
    db: DbSession,
) -> dict:
    """Enter a score on an individual assignment. Jan and Jadon only."""
    authz.require_permission(db, profile, pk.GRADES_ASSIGN)
    if not is_gradebook_operator(profile):
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="Only Jan and Jadon can grade individual assignments.",
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
        "publicationStatus": "pending_publish",
    }


@router.post("/entries/bulk-grade")
def bulk_grade_entries(
    body: BulkGradeBody,
    profile: CurrentProfile,
    db: DbSession,
) -> dict:
    """Mass-grade multiple entries at once. Jan and Jadon only."""
    authz.require_permission(db, profile, pk.GRADES_ASSIGN)
    if not is_gradebook_operator(profile):
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="Only Jan and Jadon can mass grade.",
        )
    count = len(body.items)
    gradebook.notify_peer_gradebook_change(
        db,
        profile,
        action="mass graded",
        detail=f"Applied scores to {count} entr{'y' if count == 1 else 'ies'}.",
        payload={
            "entryIds": [str(item.entry_id) for item in body.items],
            "href": "/grades",
        },
    )
    db.commit()
    return {
        "ok": True,
        "gradedCount": count,
        "entryIds": [str(item.entry_id) for item in body.items],
        "publicationStatus": "pending_publish",
    }


@router.post("/publish")
def publish_grades(body: PublishBody, profile: CurrentProfile, db: DbSession) -> dict:
    """Release scores so students can see them. Jan and Jadon only."""
    authz.require_permission(db, profile, pk.GRADES_PUBLISH)
    if not is_gradebook_operator(profile):
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="Only Jan and Jadon can publish grades.",
        )
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


@router.get("/assignment-requests")
def list_assignment_requests(profile: CurrentProfile, db: DbSession) -> dict:
    """Draft assignment requests from heads (operators) or own requests (heads)."""
    ctx = authz.build_auth_context(db, profile)
    can_review = pk.GRADES_ASSIGN in ctx.permissions and is_gradebook_operator(profile)
    can_request = pk.GRADES_REQUEST_ASSIGNMENT in ctx.permissions
    if not can_review and not can_request:
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="Permission denied.",
        )
    return {"requests": [], "scope": "all" if can_review else "own"}


@router.post("/assignment-requests", status_code=201)
def create_assignment_request(
    body: AssignmentRequestBody,
    profile: CurrentProfile,
    db: DbSession,
) -> dict:
    """Committee head sends a draft assignment request to Jan for approval."""
    ctx = authz.build_auth_context(db, profile)
    scoped = body.committee_id
    if scoped is None and len(ctx.headed_committee_ids) == 1:
        scoped = next(iter(ctx.headed_committee_ids))
    if scoped is None:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="committeeId is required when heading more than one committee.",
        )
    authz.require_permission(
        db, profile, pk.GRADES_REQUEST_ASSIGNMENT, committee_id=scoped
    )
    request_id = uuid.uuid4()
    gradebook.notify_operators_assignment_request(
        db,
        profile,
        title=body.title,
        request_id=request_id,
        committee_id=scoped,
    )
    db.commit()
    return {
        "ok": True,
        "id": str(request_id),
        "title": body.title,
        "committeeId": str(scoped),
        "status": "pending",
        "proposedCategoryId": body.proposed_category_id,
        "proposedPoints": body.proposed_points,
    }


@router.post("/assignment-requests/{request_id}/review")
def review_assignment_request(
    request_id: uuid.UUID,
    body: ReviewAssignmentRequestBody,
    profile: CurrentProfile,
    db: DbSession,
) -> dict:
    """Jan or Jadon approves or rejects a head's draft assignment request."""
    authz.require_permission(db, profile, pk.GRADES_ASSIGN)
    if not is_gradebook_operator(profile):
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="Only Jan and Jadon can approve assignment requests.",
        )
    gradebook.notify_peer_gradebook_change(
        db,
        profile,
        action=f"{body.decision}d an assignment request",
        detail=f"Assignment request {request_id} was {body.decision}d.",
        payload={"requestId": str(request_id), "href": "/grades/requests"},
    )
    db.commit()
    return {
        "ok": True,
        "id": str(request_id),
        "status": "approved" if body.decision == "approve" else "rejected",
        "note": body.note,
    }


@router.post("/committee-grades", status_code=201)
def submit_committee_grades(
    body: CommitteeGradesBody,
    profile: CurrentProfile,
    db: DbSession,
) -> dict:
    """Enter class-wide scores in the Committee grades category.

    Heads are scoped to committees they lead. Jan/Jadon may enter for any
    committee. These scores stay separate from individual assignment grades.
    """
    authz.require_permission(
        db, profile, pk.GRADES_GRADE_COMMITTEE, committee_id=body.committee_id
    )
    count = len(body.scores)
    if is_gradebook_operator(profile):
        gradebook.notify_peer_gradebook_change(
            db,
            profile,
            action="entered committee grades",
            detail=(
                f"Saved {count} committee-category score"
                f"{'s' if count != 1 else ''}."
            ),
            payload={
                "committeeId": str(body.committee_id),
                "href": "/grades/committee",
            },
        )
    else:
        gradebook.notify_operators_committee_grades(
            db,
            profile,
            committee_id=body.committee_id,
            score_count=count,
        )
    db.commit()
    return {
        "ok": True,
        "committeeId": str(body.committee_id),
        "categoryId": "cat-committee-grades",
        "gradedCount": count,
        "publicationStatus": "pending_publish",
        "assignmentTitle": body.assignment_title
        or "Committee performance",
        "pointsPossible": body.points_possible,
    }
