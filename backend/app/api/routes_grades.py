"""Protected grade endpoints with persisted assignments and scores."""

from __future__ import annotations

import uuid
from datetime import datetime
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


class CreateAssignmentBody(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    category_id: str = Field(alias="categoryId")
    points_possible: float = Field(default=10, alias="pointsPossible")
    assignment_type: str = Field(default="custom", alias="assignmentType")
    description: str | None = None
    event_id: uuid.UUID | None = Field(default=None, alias="eventId")
    committee_id: uuid.UUID | None = Field(default=None, alias="committeeId")
    due_at: datetime | None = Field(default=None, alias="dueAt")

    model_config = {"populate_by_name": True}


class GradeEntryBody(BaseModel):
    score: float | None = None
    status: str | None = None


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
    proposed_category_id: str = Field(
        default="cat-deliverables", alias="proposedCategoryId"
    )
    proposed_points: float = Field(default=10, gt=0, alias="proposedPoints")
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
    committee_id: uuid.UUID = Field(alias="committeeId")
    assignment_title: str | None = Field(default=None, alias="assignmentTitle")
    points_possible: float = Field(default=10, alias="pointsPossible")
    scores: list[CommitteeGradeScore] = Field(default_factory=list)

    model_config = {"populate_by_name": True}


def _require_operator(profile: CurrentProfile, detail: str) -> None:
    if not is_gradebook_operator(profile):
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail=detail,
        )


@router.get("/me")
def read_own_grades(profile: CurrentProfile, db: DbSession) -> dict:
    authz.require_permission(
        db,
        profile,
        pk.GRADES_VIEW_OWN,
        resource_owner_id=profile.id,
    )
    return gradebook.own_gradebook(db, profile)


@router.get("/all")
def read_all_grades(profile: CurrentProfile, db: DbSession) -> dict:
    # grades.view_all covers ASBO/AC/President; only assign/publish are
    # restricted to the Jan/Jadon operator pair.
    authz.require_permission(db, profile, pk.GRADES_VIEW_ALL)
    return gradebook.all_gradebook(db)


@router.get("/pending")
def read_pending_grades(profile: CurrentProfile, db: DbSession) -> dict:
    authz.require_permission(db, profile, pk.GRADES_PUBLISH)
    _require_operator(profile, "Only Jan and Jadon can view the publish queue.")
    return gradebook.pending_gradebook(db)


@router.get("/assignments")
def list_assignments(profile: CurrentProfile, db: DbSession) -> dict:
    authz.require_permission(db, profile, pk.GRADES_ASSIGN)
    _require_operator(profile, "Only Jan and Jadon can list gradebook assignments.")
    return gradebook.list_assignments(db)


@router.get("/assignments/{assignment_id}")
def read_assignment(
    assignment_id: uuid.UUID, profile: CurrentProfile, db: DbSession
) -> dict:
    authz.require_permission(
        db,
        profile,
        pk.GRADES_VIEW_OWN,
        resource_owner_id=profile.id,
    )
    return gradebook.assignment_detail_for_caller(db, assignment_id, profile)


@router.get("/assignments/{assignment_id}/roster")
def read_assignment_roster(
    assignment_id: uuid.UUID, profile: CurrentProfile, db: DbSession
) -> dict:
    authz.require_permission(db, profile, pk.GRADES_VIEW_ALL)
    _require_operator(profile, "Only Jan and Jadon can view assignment rosters.")
    return gradebook.assignment_roster(db, assignment_id)


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
        authz.require_permission(db, profile, pk.GRADES_VIEW_ALL)
        _require_operator(profile, "Only Jan and Jadon can view another student's grades.")
    return gradebook.user_gradebook(db, user_id, viewer=profile)


@router.post("/assignments", status_code=201)
def create_assignment(
    body: CreateAssignmentBody, profile: CurrentProfile, db: DbSession
) -> dict:
    authz.require_permission(db, profile, pk.GRADES_ASSIGN)
    _require_operator(
        profile, "Only Jan and Jadon can configure gradebook assignments."
    )
    assignment = gradebook.create_assignment(
        db,
        profile,
        title=body.title,
        category_id=body.category_id,
        points_possible=body.points_possible,
        assignment_type=body.assignment_type,
        description=body.description,
        event_id=body.event_id,
        committee_id=body.committee_id,
        due_at=body.due_at,
    )
    gradebook.notify_peer_gradebook_change(
        db,
        profile,
        action="configured an assignment",
        detail=f'Created "{assignment.title}".',
        payload={
            "assignmentId": str(assignment.id),
            "href": f"/grades/events/{assignment.id}",
        },
    )
    db.commit()
    return {
        "ok": True,
        "assignment": {
            "id": str(assignment.id),
            "title": assignment.title,
            "categoryId": assignment.category_id,
            "assignmentType": assignment.assignment_type,
            "pointsPossible": assignment.points_possible,
            "dueAt": assignment.due_at.isoformat() if assignment.due_at else None,
        },
    }


@router.put("/assignments/{assignment_id}/rubric")
def update_assignment_rubric(
    assignment_id: uuid.UUID,
    body: RubricBody,
    profile: CurrentProfile,
    db: DbSession,
) -> dict:
    """MVP stub — rubrics are not persisted yet."""
    authz.require_permission(db, profile, pk.GRADES_ASSIGN)
    _require_operator(profile, "Only Jan and Jadon can change rubrics.")
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
    body: GradeEntryBody,
    profile: CurrentProfile,
    db: DbSession,
) -> dict:
    authz.require_permission(db, profile, pk.GRADES_ASSIGN)
    _require_operator(profile, "Only Jan and Jadon can grade individual assignments.")
    entry = gradebook.grade_entry(
        db,
        profile,
        entry_id,
        score=body.score,
        status=body.status,
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
        "entry": gradebook._entry_payload(entry, include_student=True),
        "entryId": str(entry.id),
        "publicationStatus": entry.publication_status,
    }


@router.post("/entries/bulk-grade")
def bulk_grade_entries(
    body: BulkGradeBody,
    profile: CurrentProfile,
    db: DbSession,
) -> dict:
    authz.require_permission(db, profile, pk.GRADES_ASSIGN)
    _require_operator(profile, "Only Jan and Jadon can mass grade.")
    graded = gradebook.bulk_grade(
        db,
        profile,
        [
            {
                "entry_id": item.entry_id,
                "score": item.score,
                "status": item.status,
            }
            for item in body.items
        ],
    )
    count = len(graded)
    gradebook.notify_peer_gradebook_change(
        db,
        profile,
        action="mass graded",
        detail=f"Applied scores to {count} entr{'y' if count == 1 else 'ies'}.",
        payload={
            "entryIds": [str(e.id) for e in graded],
            "href": "/grades",
        },
    )
    db.commit()
    return {
        "ok": True,
        "gradedCount": count,
        "entries": [
            gradebook._entry_payload(e, include_student=True) for e in graded
        ],
        "entryIds": [str(e.id) for e in graded],
        "publicationStatus": "pending_publish",
    }


@router.post("/publish")
def publish_grades(body: PublishBody, profile: CurrentProfile, db: DbSession) -> dict:
    authz.require_permission(db, profile, pk.GRADES_PUBLISH)
    _require_operator(profile, "Only Jan and Jadon can publish grades.")
    published = gradebook.publish_entries(db, body.entry_ids)
    count = len(published)
    gradebook.notify_peer_gradebook_change(
        db,
        profile,
        action="published grades",
        detail=f"Released {count} grade{'s' if count != 1 else ''} to students.",
        payload={
            "entryIds": [str(e.id) for e in published],
            "href": "/grades",
        },
    )
    db.commit()
    return {
        "ok": True,
        "publishedCount": count,
        "entries": [
            gradebook._entry_payload(e, include_student=True) for e in published
        ],
        "entryIds": [str(e.id) for e in published],
    }


@router.get("/assignment-requests")
def list_assignment_requests(profile: CurrentProfile, db: DbSession) -> dict:
    authz.require_permission(
        db, profile, pk.GRADES_VIEW_OWN, resource_owner_id=profile.id
    )
    can_review = is_gradebook_operator(profile)
    return {
        "requests": gradebook.list_assignment_requests(db, profile),
        "scope": "all" if can_review else "own",
    }


@router.post("/assignment-requests", status_code=201)
def create_assignment_request(
    body: AssignmentRequestBody,
    profile: CurrentProfile,
    db: DbSession,
) -> dict:
    authz.require_permission(
        db, profile, pk.GRADES_VIEW_OWN, resource_owner_id=profile.id
    )
    row = gradebook.create_assignment_request(
        db,
        profile,
        title=body.title,
        description=body.description,
        category_id=body.proposed_category_id,
        points=body.proposed_points,
        committee_id=body.committee_id,
    )
    gradebook.notify_operators_assignment_request(
        db,
        profile,
        title=row.title,
        request_id=row.id,
        committee_id=row.committee_id,
    )
    db.commit()
    return gradebook._request_payload(row)


@router.post("/assignment-requests/{request_id}/review")
def review_assignment_request(
    request_id: uuid.UUID,
    body: ReviewAssignmentRequestBody,
    profile: CurrentProfile,
    db: DbSession,
) -> dict:
    authz.require_permission(db, profile, pk.GRADES_ASSIGN)
    _require_operator(profile, "Only Jan and Jadon can approve assignment requests.")
    row, assignment = gradebook.review_assignment_request(
        db,
        profile,
        request_id,
        decision=body.decision,
        note=body.note,
    )
    gradebook.notify_peer_gradebook_change(
        db,
        profile,
        action=f"{body.decision}d an assignment request",
        detail=f"Assignment request {request_id} was {body.decision}d.",
        payload={"requestId": str(request_id), "href": "/grades/requests"},
    )
    db.commit()
    result = gradebook._request_payload(row)
    result["assignment"] = (
        {
            "id": str(assignment.id),
            "title": assignment.title,
        }
        if assignment
        else None
    )
    return result


@router.post("/committee-grades", status_code=201)
def submit_committee_grades(
    body: CommitteeGradesBody,
    profile: CurrentProfile,
    db: DbSession,
) -> dict:
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
        "assignmentTitle": body.assignment_title or "Committee performance",
        "pointsPossible": body.points_possible,
    }
