"""Gradebook persistence, weighted summaries, and peer transparency notices."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import HTTPException
from fastapi import status as http_status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.gradebook import (
    ASSIGNMENT_TYPES,
    GradeAssignment,
    GradeAssignmentRequest,
    GradeEntry,
)
from app.models.profile import Profile
from app.services import notifications
from app.services.gradebook_operators import (
    is_gradebook_operator,
    peer_operator_ids,
    resolve_gradebook_operator_ids,
)
from app.services.letter_grade import letter_grade

CATEGORIES: list[dict[str, Any]] = [
    {"id": "cat-debriefs", "name": "Event debriefs", "weightPercent": 35},
    {"id": "cat-reflections", "name": "Reflections", "weightPercent": 20},
    {"id": "cat-deliverables", "name": "Deliverables", "weightPercent": 15},
    {"id": "cat-participation", "name": "Participation", "weightPercent": 10},
    {
        "id": "cat-committee-grades",
        "name": "Committee grades",
        "weightPercent": 20,
    },
]

CATEGORY_IDS = {c["id"] for c in CATEGORIES}


def _now() -> datetime:
    return datetime.now(UTC)


def _actor_label(profile: Profile) -> str:
    return (profile.full_name or "").strip() or (profile.email or "Someone")


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def notify_peer_gradebook_change(
    db: Session,
    actor: Profile,
    *,
    action: str,
    detail: str,
    payload: dict | None = None,
) -> None:
    """Tell the other gradebook operator what just changed."""
    peers = peer_operator_ids(db, actor.id)
    if not peers:
        return
    actor_name = _actor_label(actor)
    notifications.deliver(
        db,
        recipient_ids=peers,
        type="grades.changed",
        title=f"{actor_name} {action}",
        body=detail,
        payload=payload or {},
        dedupe_key=f"grades.changed:{actor.id}:{action}:{detail}",
    )


def notify_operators_assignment_request(
    db: Session,
    actor: Profile,
    *,
    title: str,
    request_id: uuid.UUID,
    committee_id: uuid.UUID | None,
) -> None:
    """Notify Jan (and Jadon) that a head sent a draft assignment request."""
    recipients = resolve_gradebook_operator_ids(db)
    if not recipients:
        return
    actor_name = _actor_label(actor)
    notifications.deliver(
        db,
        recipient_ids=recipients,
        type="grades.assignment_requested",
        title=f"{actor_name} requested a new assignment",
        body=f'Draft: "{title}" — review and approve to add it to the gradebook.',
        payload={
            "requestId": str(request_id),
            "committeeId": str(committee_id) if committee_id else None,
            "href": "/grades/requests",
        },
        dedupe_key=f"grades.assignment_requested:{request_id}",
    )


def notify_operators_committee_grades(
    db: Session,
    actor: Profile,
    *,
    committee_id: uuid.UUID,
    score_count: int,
) -> None:
    """Notify Jan/Jadon that a head submitted committee-category class grades."""
    recipients = resolve_gradebook_operator_ids(db)
    if not recipients:
        return
    actor_name = _actor_label(actor)
    notifications.deliver(
        db,
        recipient_ids=recipients,
        type="grades.committee_submitted",
        title=f"{actor_name} submitted committee grades",
        body=(
            f"{score_count} class score{'s' if score_count != 1 else ''} "
            "in the Committee grades category — publish when ready."
        ),
        payload={
            "committeeId": str(committee_id),
            "href": "/grades/committee",
        },
        dedupe_key=(
            f"grades.committee_submitted:{actor.id}:{committee_id}:{score_count}"
        ),
    )


def _entry_payload(entry: GradeEntry, *, include_student: bool = False) -> dict:
    assignment = entry.assignment
    event = assignment.event if assignment is not None else None
    committee = assignment.committee if assignment is not None else None
    payload: dict[str, Any] = {
        "id": str(entry.id),
        "assignmentId": str(entry.assignment_id),
        "assignmentTitle": assignment.title if assignment else "",
        "assignmentType": assignment.assignment_type if assignment else "custom",
        "event": (
            {"id": str(event.id), "name": event.name} if event is not None else None
        ),
        "committee": (
            {"id": str(committee.id), "name": committee.name}
            if committee is not None
            else None
        ),
        "status": entry.status,
        "score": entry.score,
        "pointsPossible": assignment.points_possible if assignment else None,
        "availableAt": _iso(assignment.available_at) if assignment else None,
        "dueAt": _iso(assignment.due_at) if assignment else None,
        "lateDueAt": _iso(assignment.late_due_at) if assignment else None,
        "submittedAt": _iso(entry.submitted_at),
        "gradedAt": _iso(entry.graded_at),
        "publicationStatus": entry.publication_status,
        "publishedAt": _iso(entry.published_at),
        "categoryId": assignment.category_id if assignment else None,
        "canSubmit": entry.status in {"not_started", "draft"},
        "canResubmit": False,
        "isLate": entry.status == "late",
    }
    if include_student:
        student = entry.student
        payload["studentId"] = str(entry.student_id)
        payload["studentName"] = (
            (student.full_name or "").strip() or student.email
            if student is not None
            else "Student"
        )
    return payload


def _counts_toward_category(entry: GradeEntry) -> bool:
    if entry.status == "excused":
        return False
    if entry.status in {"not_started", "draft"}:
        return False
    points = entry.assignment.points_possible if entry.assignment else 0
    if points <= 0:
        return False
    return entry.score is not None or entry.status == "missing"


def _weighted_summary(entries: list[GradeEntry]) -> dict[str, Any]:
    earned = 0.0
    possible = 0.0
    completed = 0
    missing = 0
    open_count = 0
    for entry in entries:
        if entry.status == "graded":
            completed += 1
        elif entry.status == "missing":
            missing += 1
        elif entry.status in {"not_started", "draft", "submitted", "late"}:
            open_count += 1
        if entry.score is not None and entry.assignment is not None:
            earned += float(entry.score)
            possible += float(entry.assignment.points_possible)

    breakdown: list[dict[str, Any]] = []
    active_weight = 0.0
    for category in CATEGORIES:
        in_cat = [
            e
            for e in entries
            if e.assignment
            and e.assignment.category_id == category["id"]
            and _counts_toward_category(e)
        ]
        if in_cat:
            active_weight += float(category["weightPercent"])

    for category in CATEGORIES:
        in_cat = [
            e
            for e in entries
            if e.assignment
            and e.assignment.category_id == category["id"]
            and _counts_toward_category(e)
        ]
        cat_earned = sum(float(e.score or 0) for e in in_cat)
        cat_possible = sum(
            float(e.assignment.points_possible) for e in in_cat if e.assignment
        )
        percent = (
            round((cat_earned / cat_possible) * 1000) / 10 if cat_possible > 0 else None
        )
        contribution = None
        if percent is not None and active_weight > 0:
            contribution = (
                round((percent * float(category["weightPercent"]) / active_weight) * 10)
                / 10
            )
        breakdown.append(
            {
                "categoryId": category["id"],
                "name": category["name"],
                "weightPercent": category["weightPercent"],
                "earnedPoints": cat_earned,
                "possiblePoints": cat_possible,
                "percent": percent,
                "weightedContribution": contribution,
                "assignmentCount": sum(
                    1
                    for e in entries
                    if e.assignment and e.assignment.category_id == category["id"]
                ),
                "scoredCount": len(in_cat),
            }
        )

    weighted_parts = [
        row["weightedContribution"]
        for row in breakdown
        if isinstance(row["weightedContribution"], (int, float))
    ]
    weighted_percent = (
        round(sum(weighted_parts) * 10) / 10 if weighted_parts else None
    )

    return {
        "completed": completed,
        "missing": missing,
        "open": open_count,
        "earnedPoints": earned,
        "possiblePoints": possible,
        "completionPercent": (
            round((earned / possible) * 100) if possible > 0 else 0
        ),
        "weightedPercent": weighted_percent,
        "categoryBreakdown": breakdown,
    }


def _load_entries_query():
    return select(GradeEntry).options(
        selectinload(GradeEntry.assignment).selectinload(GradeAssignment.event),
        selectinload(GradeEntry.assignment).selectinload(GradeAssignment.committee),
        selectinload(GradeEntry.student),
    )


def _active_profiles(db: Session) -> list[Profile]:
    return list(
        db.scalars(
            select(Profile).where(Profile.status == "active").order_by(Profile.email)
        ).all()
    )


def create_assignment(
    db: Session,
    actor: Profile,
    *,
    title: str,
    category_id: str,
    points_possible: float = 10.0,
    assignment_type: str = "custom",
    description: str | None = None,
    event_id: uuid.UUID | None = None,
    committee_id: uuid.UUID | None = None,
    due_at: datetime | None = None,
) -> GradeAssignment:
    if category_id not in CATEGORY_IDS:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown categoryId. Expected one of: {sorted(CATEGORY_IDS)}",
        )
    if assignment_type not in ASSIGNMENT_TYPES:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown assignmentType. Expected one of: {list(ASSIGNMENT_TYPES)}",
        )
    if points_possible <= 0:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="pointsPossible must be greater than zero.",
        )

    assignment = GradeAssignment(
        title=title.strip(),
        description=description,
        category_id=category_id,
        assignment_type=assignment_type,
        points_possible=float(points_possible),
        event_id=event_id,
        committee_id=committee_id,
        due_at=due_at,
        available_at=_now(),
        created_by_user_id=actor.id,
    )
    db.add(assignment)
    db.flush()

    for student in _active_profiles(db):
        db.add(
            GradeEntry(
                assignment_id=assignment.id,
                student_id=student.id,
                status="not_started",
                publication_status="draft",
            )
        )
    db.flush()
    return assignment


def _request_payload(row: GradeAssignmentRequest) -> dict[str, Any]:
    submitter = row.submitted_by
    committee = row.committee
    return {
        "id": str(row.id),
        "title": row.title,
        "description": row.description,
        "proposedCategoryId": row.proposed_category_id,
        "proposedPoints": row.proposed_points,
        "committeeId": str(row.committee_id) if row.committee_id else None,
        "committeeName": committee.name if committee else None,
        "status": row.status,
        "submittedBy": {
            "id": str(row.submitted_by_user_id),
            "name": _actor_label(submitter) if submitter else "Member",
        },
        "submittedAt": _iso(row.created_at),
        "reviewNote": row.review_note,
        "createdAssignmentId": (
            str(row.created_assignment_id) if row.created_assignment_id else None
        ),
    }


def _request_query():
    return select(GradeAssignmentRequest).options(
        selectinload(GradeAssignmentRequest.submitted_by),
        selectinload(GradeAssignmentRequest.committee),
    )


def list_assignment_requests(db: Session, viewer: Profile) -> list[dict[str, Any]]:
    query = _request_query().order_by(GradeAssignmentRequest.created_at.desc())
    if not is_gradebook_operator(viewer):
        query = query.where(
            GradeAssignmentRequest.submitted_by_user_id == viewer.id
        )
    return [_request_payload(row) for row in db.scalars(query).all()]


def create_assignment_request(
    db: Session,
    actor: Profile,
    *,
    title: str,
    description: str | None,
    category_id: str,
    points: float,
    committee_id: uuid.UUID | None,
) -> GradeAssignmentRequest:
    if category_id not in CATEGORY_IDS:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown proposedCategoryId. Expected one of: {sorted(CATEGORY_IDS)}",
        )
    if points <= 0:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="proposedPoints must be greater than zero.",
        )
    row = GradeAssignmentRequest(
        title=title.strip(),
        description=description,
        proposed_category_id=category_id,
        proposed_points=float(points),
        committee_id=committee_id,
        submitted_by_user_id=actor.id,
    )
    db.add(row)
    db.flush()
    db.refresh(row)
    return row


def review_assignment_request(
    db: Session,
    actor: Profile,
    request_id: uuid.UUID,
    *,
    decision: str,
    note: str | None,
) -> tuple[GradeAssignmentRequest, GradeAssignment | None]:
    row = db.scalars(
        _request_query().where(GradeAssignmentRequest.id == request_id)
    ).first()
    if row is None:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="Assignment proposal not found.",
        )
    if row.status != "pending":
        raise HTTPException(
            status_code=http_status.HTTP_409_CONFLICT,
            detail="Assignment proposal has already been reviewed.",
        )

    assignment = None
    if decision == "approve":
        assignment = create_assignment(
            db,
            actor,
            title=row.title,
            category_id=row.proposed_category_id,
            points_possible=row.proposed_points,
            assignment_type="custom",
            description=row.description,
            committee_id=row.committee_id,
        )
        row.status = "approved"
        row.created_assignment_id = assignment.id
    else:
        row.status = "rejected"
    row.reviewed_by_user_id = actor.id
    row.reviewed_at = _now()
    row.review_note = note
    row.updated_at = _now()
    db.flush()
    return row, assignment


def grade_entry(
    db: Session,
    actor: Profile,
    entry_id: uuid.UUID,
    *,
    score: float | None,
    status: str | None = None,
) -> GradeEntry:
    entry = db.scalars(
        _load_entries_query().where(GradeEntry.id == entry_id)
    ).first()
    if entry is None:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="Grade entry not found.",
        )
    if (
        score is not None
        and entry.assignment is not None
        and (score < 0 or score > entry.assignment.points_possible)
    ):
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="Score must be between 0 and pointsPossible.",
        )
    if status == "excused":
        entry.status = "excused"
        entry.score = None
    else:
        entry.status = status or "graded"
        entry.score = score
    entry.graded_at = _now()
    entry.graded_by_user_id = actor.id
    entry.publication_status = "pending_publish"
    entry.updated_at = _now()
    db.flush()
    return entry


def bulk_grade(
    db: Session,
    actor: Profile,
    items: list[dict[str, Any]],
) -> list[GradeEntry]:
    graded: list[GradeEntry] = []
    for item in items:
        graded.append(
            grade_entry(
                db,
                actor,
                item["entry_id"],
                score=item.get("score"),
                status=item.get("status"),
            )
        )
    return graded


def publish_entries(
    db: Session,
    entry_ids: list[uuid.UUID],
) -> list[GradeEntry]:
    if not entry_ids:
        return []
    entries = list(
        db.scalars(_load_entries_query().where(GradeEntry.id.in_(entry_ids))).all()
    )
    now = _now()
    for entry in entries:
        entry.publication_status = "published"
        entry.published_at = now
        entry.updated_at = now
    db.flush()
    return entries


def own_gradebook(db: Session, profile: Profile) -> dict:
    entries = list(
        db.scalars(
            _load_entries_query()
            .where(GradeEntry.student_id == profile.id)
            .order_by(GradeEntry.created_at.desc())
        ).all()
    )
    operator = is_gradebook_operator(profile)
    # Students only see published rows. Operators see their own rows in any state
    # on /me; use assignment roster for the class view.
    visible = (
        entries
        if operator
        else [e for e in entries if e.publication_status == "published"]
    )

    summary = _weighted_summary(visible)
    return {
        "user_id": str(profile.id),
        "entries": [_entry_payload(e) for e in visible],
        "summary": summary,
        "visibility": "all" if operator else "published_only",
        "categories": CATEGORIES,
        "student": {
            "id": str(profile.id),
            "name": _actor_label(profile),
            "committee": None,
        },
    }


def all_gradebook(db: Session) -> dict:
    entries = list(
        db.scalars(_load_entries_query().order_by(GradeEntry.created_at.desc())).all()
    )
    return {
        "entries": [_entry_payload(e, include_student=True) for e in entries],
        "scope": "all",
        "categories": CATEGORIES,
    }


def pending_gradebook(db: Session) -> dict:
    entries = list(
        db.scalars(
            _load_entries_query()
            .where(GradeEntry.publication_status == "pending_publish")
            .order_by(GradeEntry.updated_at.desc())
        ).all()
    )
    return {
        "entries": [_entry_payload(e, include_student=True) for e in entries],
        "scope": "pending_publish",
        "categories": CATEGORIES,
    }


def user_gradebook(db: Session, user_id: uuid.UUID, *, viewer: Profile) -> dict:
    entries = list(
        db.scalars(
            _load_entries_query()
            .where(GradeEntry.student_id == user_id)
            .order_by(GradeEntry.created_at.desc())
        ).all()
    )
    if viewer.id != user_id and not is_gradebook_operator(viewer):
        entries = [e for e in entries if e.publication_status == "published"]
    student = db.get(Profile, user_id)
    summary = _weighted_summary(entries)
    return {
        "user_id": str(user_id),
        "entries": [_entry_payload(e) for e in entries],
        "summary": summary,
        "categories": CATEGORIES,
        "student": {
            "id": str(user_id),
            "name": _actor_label(student) if student else "Student",
            "committee": None,
        },
    }


def assignment_detail_for_caller(
    db: Session, assignment_id: uuid.UUID, profile: Profile
) -> dict:
    entry = db.scalars(
        _load_entries_query().where(
            GradeEntry.assignment_id == assignment_id,
            GradeEntry.student_id == profile.id,
        )
    ).first()
    if entry is None:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="Assignment not found for this student.",
        )
    if (
        not is_gradebook_operator(profile)
        and entry.publication_status != "published"
        and entry.status not in {"not_started", "draft", "submitted", "late"}
        and entry.score is not None
    ):
        # Students may open their own ungraded work; hide unpublished graded scores.
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="Assignment not found for this student.",
        )
    points = entry.assignment.points_possible if entry.assignment else 10
    return {
        "entry": _entry_payload(entry),
        "submission": None,
        "feedback": None,
        "rubric": {
            "criteria": [
                {
                    "id": "content",
                    "label": "Content",
                    "pointsPossible": points,
                    "kind": "manual",
                    "isDefault": False,
                }
            ]
        },
        "rubricEvaluation": None,
        "student": {
            "id": str(profile.id),
            "name": _actor_label(profile),
            "committee": None,
        },
    }


def assignment_roster(db: Session, assignment_id: uuid.UUID) -> dict:
    assignment = db.get(GradeAssignment, assignment_id)
    if assignment is None:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="Assignment not found.",
        )
    entries = list(
        db.scalars(
            _load_entries_query()
            .where(GradeEntry.assignment_id == assignment_id)
            .order_by(GradeEntry.created_at)
        ).all()
    )
    completed = sum(1 for e in entries if e.status == "graded")
    event = assignment.event
    return {
        "event": (
            {"id": str(event.id), "name": event.name}
            if event is not None
            else {"id": str(assignment.id), "name": assignment.title}
        ),
        "assignmentTitle": assignment.title,
        "assignmentId": str(assignment.id),
        "completionCompleted": completed,
        "completionTotal": len(entries),
        "rows": [
            {
                "studentId": str(e.student_id),
                "studentName": (
                    (e.student.full_name or "").strip() or e.student.email
                    if e.student is not None
                    else "Student"
                ),
                "committee": None,
                "status": e.status,
                "score": e.score,
                "pointsPossible": assignment.points_possible,
                "entryId": str(e.id),
                "assignmentId": str(assignment.id),
            }
            for e in entries
        ],
    }


def list_assignments(db: Session) -> dict:
    rows = list(
        db.scalars(
            select(GradeAssignment).order_by(GradeAssignment.created_at.desc())
        ).all()
    )
    return {
        "assignments": [
            {
                "id": str(a.id),
                "title": a.title,
                "categoryId": a.category_id,
                "assignmentType": a.assignment_type,
                "pointsPossible": a.points_possible,
                "dueAt": _iso(a.due_at),
                "eventId": str(a.event_id) if a.event_id else None,
                "createdAt": _iso(a.created_at),
            }
            for a in rows
        ]
    }


def _score_band(percent: float | None) -> str | None:
    if percent is None:
        return None
    if percent >= 97:
        return "a-plus"
    if percent >= 93:
        return "a"
    if percent >= 90:
        return "a-minus"
    if percent >= 70:
        return "bc"
    return "below-c"


def dashboard_payload(db: Session, profile: Profile) -> dict:
    """Thin dashboard: live grade standing; other sections empty for now."""
    book = own_gradebook(db, profile)
    summary = book["summary"]
    weighted = summary.get("weightedPercent")
    entries = book["entries"]
    rows = []
    for entry in entries[:8]:
        possible = entry.get("pointsPossible") or 0
        score = entry.get("score")
        percent = (
            round((float(score) / float(possible)) * 100)
            if score is not None and possible
            else None
        )
        status = entry.get("status") or "not_started"
        tone = "neutral"
        label = status.replace("_", " ").title()
        if status == "graded":
            tone = "accent"
            label = "Graded"
        elif status == "missing":
            tone = "danger"
            label = "Missing"
        elif status in {"draft", "submitted", "late"}:
            tone = "warning"
        rows.append(
            {
                "id": entry["id"],
                "assignment": entry["assignmentTitle"],
                "event": (entry.get("event") or {}).get("name")
                if entry.get("event")
                else None,
                "status": {"label": label, "tone": tone},
                "earned": score,
                "possible": possible,
                "band": _score_band(percent),
            }
        )

    return {
        "committee": None,
        "campsiteCount": 0,
        "stats": {
            "gradeLetter": letter_grade(weighted),
            "gradePercent": weighted,
            "openCount": summary.get("open") or 0,
        },
        "nextEvent": None,
        "calendar": [],
        "attention": [],
        "grades": {
            "completed": summary.get("completed") or 0,
            "missing": summary.get("missing") or 0,
            "open": summary.get("open") or 0,
            "pointsEarned": summary.get("earnedPoints") or 0,
            "pointsPossible": summary.get("possiblePoints") or 0,
            "rows": rows,
        },
        "progress": {
            "gradeLetter": letter_grade(weighted),
            "gradePercent": weighted,
            "nextBand": None,
            "nextBandMin": None,
            "streakWeeks": 0,
            "tasksDone": 0,
            "participationRate": 0,
            "note": None,
        },
        "activity": [],
        "committeeSnapshot": None,
        "liveDebrief": None,
        "upcoming": [],
    }
