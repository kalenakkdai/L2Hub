"""Event planning boards.

Anonymous reports store an author on the row and never put that person in a
response. Review is limited to feedback.view_anonymous.
"""

from __future__ import annotations

import json
import uuid
from datetime import UTC, date, datetime

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core import permission_keys as pk
from app.models import Committee, EventPlan, EventPlanAssignment, EventPlanReport, Profile
from app.models.rbac import CommitteeMembership
from app.services import authorization as authz
from app.services.work import member_committee_ids

OPEN_FOR_RESPONSE = frozenset({"enabled", "active"})
REPORT_CATEGORIES = frozenset(
    {
        "inefficiency",
        "disruptive",
        "not_completing_on_time",
        "not_doing_work",
        "other",
    }
)
ATTACHMENT_TYPES = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
    "application/pdf": "pdf",
}
MAX_ATTACHMENTS = 5
MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024
MAX_DATA_URL_CHARS = 7_000_000
MAX_AGENDA_CHARS = 100_000


def _now() -> datetime:
    return datetime.now(UTC)


def _iso(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    return value.isoformat()


def _missing(message: str) -> None:
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail={"code": "not_found", "message": message},
    )


def _invalid(message: str) -> None:
    raise HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        detail={"code": "invalid_input", "message": message},
    )


def _conflict(message: str) -> None:
    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail={"code": "invalid_transition", "message": message},
    )


def _parse_uuid(value: str) -> uuid.UUID | None:
    try:
        return uuid.UUID(str(value))
    except (TypeError, ValueError):
        return None


def _person_name(profile: Profile | None) -> str:
    if profile is None:
        return "Camper"
    name = (profile.full_name or "").strip()
    return name or "Camper"


def _require_view(db: Session, profile: Profile) -> None:
    authz.require_permission(db, profile, pk.PLANNING_VIEW)


def _load_plan(db: Session, plan_id: str) -> EventPlan:
    parsed = _parse_uuid(plan_id)
    plan = None
    if parsed is not None:
        plan = db.scalar(
            select(EventPlan)
            .where(EventPlan.id == parsed)
            .options(
                selectinload(EventPlan.assignments).selectinload(
                    EventPlanAssignment.committee
                ),
                selectinload(EventPlan.assignments).selectinload(
                    EventPlanAssignment.member
                ),
                selectinload(EventPlan.created_by),
                selectinload(EventPlan.enabled_by),
            )
        )
    if plan is None:
        _missing("Plan not found.")
    return plan


def _assignment_payload(row: EventPlanAssignment) -> dict:
    return {
        "id": str(row.id),
        "targetType": row.target_type,
        "committeeId": str(row.committee_id) if row.committee_id else None,
        "committeeName": row.committee.name if row.committee is not None else None,
        "memberId": str(row.member_user_id) if row.member_user_id else None,
        "memberName": _person_name(row.member) if row.member_user_id else None,
        "roleLabel": row.role_label,
        "status": row.status,
    }


def _agenda_payload(raw: str, title: str) -> dict:
    try:
        data = json.loads(raw) if raw else {}
    except json.JSONDecodeError:
        data = {}
    if not isinstance(data, dict):
        data = {}
    goals = data.get("goals")
    sections = data.get("sections")
    return {
        "schoolName": data.get("schoolName") or "MISSION SAN JOSE HIGH SCHOOL",
        "schoolYear": data.get("schoolYear") or "",
        "title": data.get("title") or title,
        "goals": goals if isinstance(goals, list) else [],
        "sections": sections if isinstance(sections, list) else [],
        "generatedAt": data.get("generatedAt") or "",
        "templateSource": data.get("templateSource") or "Winter Ball planning agenda",
    }


def _commit_plan(db: Session, plan_id: str) -> dict:
    """Persist, then reload. expire_on_commit is off, so a loaded plan would
    otherwise keep the assignment list from before this write.
    """
    db.commit()
    db.expire_all()
    return _plan_payload(_load_plan(db, plan_id))


def _plan_payload(plan: EventPlan) -> dict:
    return {
        "id": str(plan.id),
        "title": plan.title,
        "summary": plan.summary,
        "eventDate": plan.event_date.isoformat() if plan.event_date else None,
        "status": plan.status,
        "createdById": str(plan.created_by_user_id),
        "createdByName": _person_name(plan.created_by),
        "createdAt": _iso(plan.created_at) or "",
        "enabledAt": _iso(plan.enabled_at),
        "enabledByName": _person_name(plan.enabled_by) if plan.enabled_by_user_id else None,
        "assignments": [_assignment_payload(row) for row in plan.assignments],
        "agenda": _agenda_payload(plan.agenda_json, plan.title),
    }


def _normalize_agenda(agenda: dict | None, title: str, now: datetime) -> str:
    if agenda is None:
        agenda = {}
    if not isinstance(agenda, dict):
        _invalid("Agenda must be an object.")
    document = {
        "schoolName": agenda.get("schoolName") or "MISSION SAN JOSE HIGH SCHOOL",
        "schoolYear": str(agenda.get("schoolYear") or ""),
        "title": str(agenda.get("title") or title),
        "goals": agenda.get("goals") if isinstance(agenda.get("goals"), list) else [],
        "sections": agenda.get("sections") if isinstance(agenda.get("sections"), list) else [],
        "generatedAt": str(agenda.get("generatedAt") or _iso(now)),
        "templateSource": str(
            agenda.get("templateSource") or "Winter Ball planning agenda"
        ),
    }
    encoded = json.dumps(document)
    if len(encoded) > MAX_AGENDA_CHARS:
        _invalid("Agenda is too large.")
    return encoded


def _clean_text(value: object, *, field: str, max_len: int, required: bool) -> str:
    text = str(value or "").strip()
    if required and not text:
        _invalid(f"{field} is required.")
    if len(text) > max_len:
        _invalid(f"{field} is too long.")
    return text


def list_plans(db: Session, profile: Profile) -> list[dict]:
    _require_view(db, profile)
    rows = db.scalars(
        select(EventPlan)
        .options(
            selectinload(EventPlan.assignments).selectinload(EventPlanAssignment.committee),
            selectinload(EventPlan.assignments).selectinload(EventPlanAssignment.member),
            selectinload(EventPlan.created_by),
            selectinload(EventPlan.enabled_by),
        )
        .order_by(EventPlan.created_at.desc())
    ).all()
    return [_plan_payload(row) for row in rows]


def get_plan(db: Session, profile: Profile, plan_id: str) -> dict:
    _require_view(db, profile)
    return _plan_payload(_load_plan(db, plan_id))


def list_members(db: Session, profile: Profile) -> list[dict]:
    _require_view(db, profile)
    people = db.scalars(
        select(Profile)
        .where(Profile.status == "active")
        .options(
            selectinload(Profile.committee_memberships).selectinload(
                CommitteeMembership.committee
            )
        )
        .order_by(Profile.full_name)
    ).all()
    members: list[dict] = []
    for person in people:
        membership = next(
            (
                row
                for row in person.committee_memberships
                if row.committee is not None and row.committee.slug != "spirit"
            ),
            None,
        )
        members.append(
            {
                "id": str(person.id),
                "name": _person_name(person),
                "committeeId": str(membership.committee_id) if membership else None,
                "committeeName": membership.committee.name if membership else None,
            }
        )
    return members


def list_committees(db: Session, profile: Profile) -> list[dict]:
    _require_view(db, profile)
    rows = db.scalars(
        select(Committee).where(Committee.slug != "spirit").order_by(Committee.name)
    ).all()
    return [{"id": str(row.id), "name": row.name} for row in rows]


def _committee_from_ref(db: Session, committee_id: str | None) -> Committee | None:
    if not committee_id:
        return None
    parsed = _parse_uuid(committee_id)
    if parsed is not None:
        committee = db.get(Committee, parsed)
        if committee is not None:
            return committee
    slug = committee_id.removeprefix("com-")
    return db.scalar(select(Committee).where(Committee.slug == slug))


def _add_assignment(
    db: Session,
    plan: EventPlan,
    *,
    target_type: str,
    committee_id: str | None,
    member_id: str | None,
    role_label: str,
) -> None:
    label = _clean_text(role_label, field="Role", max_len=80, required=True)
    if target_type == "committee":
        committee = _committee_from_ref(db, committee_id)
        if committee is None or committee.slug == "spirit":
            _invalid("Choose a committee.")
        db.add(
            EventPlanAssignment(
                id=uuid.uuid4(),
                plan_id=plan.id,
                target_type="committee",
                committee_id=committee.id,
                role_label=label,
                status="invited",
            )
        )
        return
    if target_type == "individual":
        parsed = _parse_uuid(member_id or "")
        member = db.get(Profile, parsed) if parsed else None
        if member is None:
            _invalid("Choose a camper.")
        db.add(
            EventPlanAssignment(
                id=uuid.uuid4(),
                plan_id=plan.id,
                target_type="individual",
                member_user_id=member.id,
                role_label=label,
                status="invited",
            )
        )
        return
    _invalid("Assignment target must be a committee or a camper.")


def create_plan(db: Session, profile: Profile, body: dict) -> dict:
    authz.require_permission(db, profile, pk.PLANNING_CREATE)
    title = _clean_text(body.get("title"), field="Title", max_len=120, required=True)
    summary = _clean_text(body.get("summary"), field="Summary", max_len=2000, required=False)
    event_date = body.get("eventDate")
    if event_date is not None and not isinstance(event_date, date):
        _invalid("Event date is invalid.")
    now = _now()
    plan = EventPlan(
        id=uuid.uuid4(),
        title=title,
        summary=summary,
        event_date=event_date,
        status="draft",
        created_by_user_id=profile.id,
        agenda_json=_normalize_agenda(body.get("agenda"), title, now),
        created_at=now,
        updated_at=now,
    )
    db.add(plan)
    db.flush()
    for item in body.get("initialAssignments") or []:
        if not isinstance(item, dict):
            _invalid("Assignment is invalid.")
        _add_assignment(
            db,
            plan,
            target_type=str(item.get("targetType") or ""),
            committee_id=item.get("committeeId"),
            member_id=item.get("memberId"),
            role_label=str(item.get("roleLabel") or ""),
        )
    return _commit_plan(db, str(plan.id))


def submit_for_enablement(db: Session, profile: Profile, plan_id: str) -> dict:
    authz.require_permission(db, profile, pk.PLANNING_CREATE)
    plan = _load_plan(db, plan_id)
    if plan.created_by_user_id != profile.id:
        raise authz.permission_denied(message="Only the plan owner can send it for enablement.")
    if plan.status == "pending_enablement":
        return _plan_payload(plan)
    if plan.status != "draft":
        _conflict("This plan has already left draft.")
    plan.status = "pending_enablement"
    plan.updated_at = _now()
    return _commit_plan(db, plan_id)


def enable_plan(db: Session, profile: Profile, plan_id: str) -> dict:
    authz.require_permission(db, profile, pk.PLANNING_ENABLE)
    plan = _load_plan(db, plan_id)
    if plan.status in OPEN_FOR_RESPONSE:
        return _plan_payload(plan)
    if plan.status != "pending_enablement":
        _conflict("Send the plan for enablement before enabling it.")
    now = _now()
    plan.status = "enabled"
    plan.enabled_by_user_id = profile.id
    plan.enabled_at = now
    plan.updated_at = now
    return _commit_plan(db, plan_id)


def _can_assign(db: Session, profile: Profile, plan: EventPlan) -> bool:
    if plan.created_by_user_id == profile.id:
        return True
    return authz.has_permission(db, profile, pk.PLANNING_ENABLE)


def assign(db: Session, profile: Profile, plan_id: str, body: dict) -> dict:
    authz.require_permission(db, profile, pk.PLANNING_ASSIGN)
    plan = _load_plan(db, plan_id)
    if not _can_assign(db, profile, plan):
        raise authz.permission_denied(
            message="Only the plan owner or an ASBO can assign people."
        )
    if plan.status == "completed":
        _conflict("This plan is already completed.")
    _add_assignment(
        db,
        plan,
        target_type=str(body.get("targetType") or ""),
        committee_id=body.get("committeeId"),
        member_id=body.get("memberId"),
        role_label=str(body.get("roleLabel") or ""),
    )
    plan.updated_at = _now()
    return _commit_plan(db, plan_id)


def _can_respond(db: Session, profile: Profile, row: EventPlanAssignment) -> bool:
    if authz.has_permission(db, profile, pk.PLANNING_ENABLE):
        return True
    if row.target_type == "individual":
        return row.member_user_id == profile.id
    if row.target_type == "committee" and row.committee_id is not None:
        return row.committee_id in member_committee_ids(profile)
    return False


def _respond(
    db: Session, profile: Profile, plan_id: str, assignment_id: str, *, decision: str
) -> dict:
    _require_view(db, profile)
    plan = _load_plan(db, plan_id)
    if plan.status not in OPEN_FOR_RESPONSE:
        _conflict("Assignees cannot accept until an ASBO enables this plan.")
    parsed = _parse_uuid(assignment_id)
    row = next((item for item in plan.assignments if item.id == parsed), None)
    if row is None:
        _missing("Assignment not found.")
    if row.status == decision:
        return _plan_payload(plan)
    if row.status != "invited":
        _conflict("This assignment has already been answered.")
    if not _can_respond(db, profile, row):
        raise authz.permission_denied(message="This assignment is not yours.")
    row.status = decision
    if decision == "accepted" and plan.status == "enabled":
        plan.status = "active"
    plan.updated_at = _now()
    return _commit_plan(db, plan_id)


def accept_assignment(
    db: Session, profile: Profile, plan_id: str, assignment_id: str
) -> dict:
    return _respond(db, profile, plan_id, assignment_id, decision="accepted")


def decline_assignment(
    db: Session, profile: Profile, plan_id: str, assignment_id: str
) -> dict:
    return _respond(db, profile, plan_id, assignment_id, decision="declined")


def _safe_attachments(raw_items: object) -> str:
    if raw_items is None:
        return "[]"
    if not isinstance(raw_items, list):
        _invalid("Attachments must be a list.")
    if len(raw_items) > MAX_ATTACHMENTS:
        _invalid("A report can include at most 5 attachments.")
    stored: list[dict] = []
    for index, item in enumerate(raw_items, start=1):
        if not isinstance(item, dict):
            _invalid("Attachment is invalid.")
        mime = item.get("mimeType")
        extension = ATTACHMENT_TYPES.get(str(mime))
        if extension is None:
            _invalid("Attachment must be a PNG, JPEG, WEBP, GIF, or PDF.")
        data_url = item.get("dataUrl")
        if not isinstance(data_url, str) or not data_url.startswith(f"data:{mime}"):
            _invalid("Attachment data is invalid.")
        if len(data_url) > MAX_DATA_URL_CHARS:
            _invalid("Attachment is too large.")
        size = item.get("sizeBytes")
        if isinstance(size, bool) or not isinstance(size, int):
            size = 0
        if size < 0 or size > MAX_ATTACHMENT_BYTES:
            _invalid("Attachment is too large.")
        stored.append(
            {
                "id": str(uuid.uuid4()),
                "displayName": f"screenshot-{index}.{extension}",
                "mimeType": mime,
                "sizeBytes": size,
                "dataUrl": data_url,
            }
        )
    return json.dumps(stored)


def _report_payload(row: EventPlanReport) -> dict:
    """Redacted report. The author column is intentionally unread here."""
    try:
        attachments = json.loads(row.attachments_json or "[]")
    except json.JSONDecodeError:
        attachments = []
    safe: list[dict] = []
    if isinstance(attachments, list):
        for index, item in enumerate(attachments, start=1):
            if not isinstance(item, dict):
                continue
            mime = str(item.get("mimeType") or "")
            extension = ATTACHMENT_TYPES.get(mime)
            data_url = item.get("dataUrl")
            if extension is None or not isinstance(data_url, str):
                continue
            size = item.get("sizeBytes")
            safe.append(
                {
                    "id": str(item.get("id") or uuid.uuid4()),
                    "displayName": f"screenshot-{index}.{extension}",
                    "mimeType": mime,
                    "sizeBytes": size if isinstance(size, int) and not isinstance(size, bool) else 0,
                    "dataUrl": data_url,
                }
            )
    return {
        "id": str(row.id),
        "planId": str(row.plan_id),
        "subjectMemberId": str(row.subject_user_id),
        "subjectMemberName": _person_name(row.subject),
        "category": row.category,
        "details": row.details,
        "attachments": safe,
        "createdAt": _iso(row.created_at) or "",
    }


def submit_report(db: Session, profile: Profile, plan_id: str, body: dict) -> None:
    _require_view(db, profile)
    plan = _load_plan(db, plan_id)
    subject_id = _parse_uuid(str(body.get("subjectMemberId") or ""))
    subject = db.get(Profile, subject_id) if subject_id else None
    if subject is None:
        _invalid("Choose the camper this report is about.")
    category = str(body.get("category") or "")
    if category not in REPORT_CATEGORIES:
        _invalid("Choose a report category.")
    details = _clean_text(body.get("details"), field="Details", max_len=4000, required=True)
    now = _now()
    db.add(
        EventPlanReport(
            id=uuid.uuid4(),
            plan_id=plan.id,
            author_user_id=profile.id,
            subject_user_id=subject.id,
            category=category,
            details=details,
            attachments_json=_safe_attachments(body.get("attachments")),
            created_at=now,
        )
    )
    db.commit()


def list_reports(db: Session, profile: Profile, plan_id: str) -> list[dict]:
    authz.require_permission(db, profile, pk.FEEDBACK_VIEW_ANONYMOUS)
    plan = _load_plan(db, plan_id)
    rows = db.scalars(
        select(EventPlanReport)
        .where(EventPlanReport.plan_id == plan.id)
        .options(selectinload(EventPlanReport.subject))
        .order_by(EventPlanReport.created_at)
    ).all()
    return [_report_payload(row) for row in rows]
