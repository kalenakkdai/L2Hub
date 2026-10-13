"""Event planning boards, assignments, and redacted anonymous reports."""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict, Field

from app.api.deps import CurrentProfile, DbSession
from app.services import event_planning

router = APIRouter(prefix="/event-plans", tags=["event-plans"])


class AssignmentIn(BaseModel):
    target_type: str = Field(alias="targetType")
    committee_id: str | None = Field(default=None, alias="committeeId")
    member_id: str | None = Field(default=None, alias="memberId")
    role_label: str = Field(alias="roleLabel")

    model_config = ConfigDict(populate_by_name=True)


class CreatePlan(BaseModel):
    title: str
    summary: str = ""
    event_date: date | None = Field(default=None, alias="eventDate")
    agenda: dict | None = None
    initial_assignments: list[AssignmentIn] | None = Field(
        default=None, alias="initialAssignments"
    )

    model_config = ConfigDict(populate_by_name=True)


class ReportIn(BaseModel):
    subject_member_id: str = Field(alias="subjectMemberId")
    category: str
    details: str
    attachments: list[dict] | None = None

    model_config = ConfigDict(populate_by_name=True)


@router.get("/members")
def read_members(profile: CurrentProfile, db: DbSession) -> list[dict]:
    return event_planning.list_members(db, profile)


@router.get("/committees")
def read_committees(profile: CurrentProfile, db: DbSession) -> list[dict]:
    return event_planning.list_committees(db, profile)


@router.get("")
def read_plans(profile: CurrentProfile, db: DbSession) -> list[dict]:
    return event_planning.list_plans(db, profile)


@router.post("")
def create_plan(body: CreatePlan, profile: CurrentProfile, db: DbSession) -> dict:
    payload = body.model_dump(exclude_unset=True, by_alias=True)
    payload["initialAssignments"] = [
        item.model_dump(by_alias=True) for item in body.initial_assignments or []
    ]
    return event_planning.create_plan(db, profile, payload)


@router.get("/{plan_id}")
def read_plan(plan_id: str, profile: CurrentProfile, db: DbSession) -> dict:
    return event_planning.get_plan(db, profile, plan_id)


@router.post("/{plan_id}/submit")
def submit_plan(plan_id: str, profile: CurrentProfile, db: DbSession) -> dict:
    return event_planning.submit_for_enablement(db, profile, plan_id)


@router.post("/{plan_id}/enable")
def enable_plan(plan_id: str, profile: CurrentProfile, db: DbSession) -> dict:
    return event_planning.enable_plan(db, profile, plan_id)


@router.post("/{plan_id}/assignments")
def assign(
    plan_id: str, body: AssignmentIn, profile: CurrentProfile, db: DbSession
) -> dict:
    return event_planning.assign(db, profile, plan_id, body.model_dump(by_alias=True))


@router.post("/{plan_id}/assignments/{assignment_id}/accept")
def accept_assignment(
    plan_id: str, assignment_id: str, profile: CurrentProfile, db: DbSession
) -> dict:
    return event_planning.accept_assignment(db, profile, plan_id, assignment_id)


@router.post("/{plan_id}/assignments/{assignment_id}/decline")
def decline_assignment(
    plan_id: str, assignment_id: str, profile: CurrentProfile, db: DbSession
) -> dict:
    return event_planning.decline_assignment(db, profile, plan_id, assignment_id)


@router.post("/{plan_id}/reports")
def submit_report(
    plan_id: str, body: ReportIn, profile: CurrentProfile, db: DbSession
) -> dict:
    event_planning.submit_report(db, profile, plan_id, body.model_dump(by_alias=True))
    return {"ok": True}


@router.get("/{plan_id}/reports")
def read_reports(plan_id: str, profile: CurrentProfile, db: DbSession) -> list[dict]:
    return event_planning.list_reports(db, profile, plan_id)
