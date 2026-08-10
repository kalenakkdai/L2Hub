"""L2 Board and cross-committee request endpoints."""

from __future__ import annotations

import uuid
from datetime import date

from fastapi import APIRouter
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.api.deps import CurrentProfile, DbSession
from app.core import permission_keys as pk
from app.models import Committee
from app.services import authorization as authz
from app.services import work

router = APIRouter(tags=["work"])


class NewTask(BaseModel):
    committee_id: uuid.UUID = Field(alias="committeeId")
    title: str
    details: str = ""
    assignee_user_id: uuid.UUID | None = Field(default=None, alias="assigneeUserId")
    due_on: date | None = Field(default=None, alias="dueOn")
    #: Committees whose help this task needs. Each becomes an open request.
    collaborator_committee_ids: list[uuid.UUID] = Field(
        default_factory=list, alias="collaboratorCommitteeIds"
    )

    model_config = {"populate_by_name": True}


class TaskUpdate(BaseModel):
    status: str | None = None
    assignee_user_id: uuid.UUID | None = Field(default=None, alias="assigneeUserId")
    clear_assignee: bool = Field(default=False, alias="clearAssignee")

    model_config = {"populate_by_name": True}


class NewRequest(BaseModel):
    requesting_committee_id: uuid.UUID = Field(alias="requestingCommitteeId")
    target_committee_id: uuid.UUID = Field(alias="targetCommitteeId")
    title: str
    details: str = ""
    due_on: date | None = Field(default=None, alias="dueOn")

    model_config = {"populate_by_name": True}


class RequestResponse(BaseModel):
    status: str


@router.get("/board")
def read_board(profile: CurrentProfile, db: DbSession) -> dict:
    """Every committee and its tasks — the L2 Board."""
    return work.board_payload(db, profile)


@router.get("/board/committees")
def board_committees(profile: CurrentProfile, db: DbSession) -> dict:
    """Committee picker options for the involvement dropdown.

    Separate from /board so the dashboard widget, which never loads the board,
    can still populate its target list.
    """
    authz.require_permission(db, profile, pk.COMMITTEES_VIEW)
    committees = db.scalars(select(Committee).order_by(Committee.name)).all()
    writable = work.writable_committee_ids(db, profile)
    return {
        "committees": [
            {
                "id": str(c.id),
                "name": c.name,
                "slug": c.slug,
                "canRequestFor": c.id in writable,
            }
            for c in committees
        ]
    }


@router.post("/board/tasks", status_code=201)
def create_task(body: NewTask, profile: CurrentProfile, db: DbSession) -> dict:
    task, fanned = work.create_task(
        db,
        profile,
        committee_id=body.committee_id,
        title=body.title,
        details=body.details,
        assignee_user_id=body.assignee_user_id,
        due_on=body.due_on,
        collaborator_committee_ids=body.collaborator_committee_ids,
    )
    return {
        "task": work.task_payload(task),
        "requests": [work.request_payload(r) for r in fanned],
    }


@router.patch("/board/tasks/{task_id}")
def update_task(
    task_id: uuid.UUID, body: TaskUpdate, profile: CurrentProfile, db: DbSession
) -> dict:
    task = work.update_task(
        db,
        profile,
        task_id,
        status=body.status,
        assignee_user_id=body.assignee_user_id,
        clear_assignee=body.clear_assignee,
    )
    return {"task": work.task_payload(task)}


@router.get("/requests")
def list_requests(profile: CurrentProfile, db: DbSession) -> dict:
    """The cross-org request log. Leadership only."""
    return work.list_all_requests(db, profile)


@router.get("/requests/mine")
def list_my_requests(profile: CurrentProfile, db: DbSession) -> dict:
    """Inbound and outbound for the caller's own committees."""
    return work.list_my_requests(db, profile)


@router.post("/requests", status_code=201)
def create_request(body: NewRequest, profile: CurrentProfile, db: DbSession) -> dict:
    request = work.create_request(
        db,
        profile,
        requesting_committee_id=body.requesting_committee_id,
        target_committee_id=body.target_committee_id,
        title=body.title,
        details=body.details,
        due_on=body.due_on,
    )
    return {"request": work.request_payload(request)}


@router.post("/requests/{request_id}/respond")
def respond_to_request(
    request_id: uuid.UUID,
    body: RequestResponse,
    profile: CurrentProfile,
    db: DbSession,
) -> dict:
    request = work.respond_to_request(db, profile, request_id, status=body.status)
    return {"request": work.request_payload(request)}
