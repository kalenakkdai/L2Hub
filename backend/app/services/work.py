"""The L2 Board and the cross-committee request log.

Two ideas live here. `board_payload` is the read side: every committee and the
tasks inside it, in one pass. `create_task` and the request helpers are the
write side, including the fan-out that turns "we also need Publicity" into an
actual row Publicity can see.

Authorization is resolved here rather than in the routes, because the same
rules apply from three entry points: the board, the /requests page, and the
dashboard widget a member uses without ever seeing either.
"""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime

from fastapi import HTTPException
from fastapi import status as http_status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from app.core import permission_keys as pk
from app.models import Committee, CommitteeMembership, Profile
from app.models.event_summary import Event
from app.models.work import (
    REQUEST_OPEN_STATUSES,
    REQUEST_STATUSES,
    TASK_STATUSES,
    CommitteeRequest,
    Task,
)
from app.services import authorization as authz
from app.services import notifications


def _now() -> datetime:
    return datetime.now(UTC)


# ---------------------------------------------------------------------------
# Scope
# ---------------------------------------------------------------------------


def member_committee_ids(profile: Profile) -> set[uuid.UUID]:
    """The committees this camper belongs to."""
    return {m.committee_id for m in profile.committee_memberships}


def writable_committee_ids(db: Session, profile: Profile) -> set[uuid.UUID]:
    """Committees the caller may act on behalf of.

    Membership is the rule. Platform ops — the roles holding requests.manage_all
    — may act for any committee, because they are the ones unsticking work
    nobody else can. Seeing every committee is not the same as speaking for
    one: a committee head holds requests.view_all and still only writes inside
    the committee they are in.
    """
    if authz.has_permission(db, profile, pk.REQUESTS_MANAGE_ALL):
        return {c.id for c in db.scalars(select(Committee)).all()}
    return member_committee_ids(profile)


def task_writable_committee_ids(db: Session, profile: Profile) -> set[uuid.UUID]:
    """Committees where `create_task` would actually succeed.

    Mirrors `_require_committee_scope`. This is a different question from
    `writable_committee_ids`, which answers "who may speak for a committee in
    the request flow" — a plain member may file a request for their committee
    but may not put work on its board, because tasks.manage_committee resolves
    through headship. Two rules, two names: reusing the request one told
    members they could add a task and then refused them at the write.
    """
    if authz.has_permission(db, profile, pk.TASKS_MANAGE_ALL):
        return {c.id for c in db.scalars(select(Committee)).all()}
    return {
        committee_id
        for committee_id in member_committee_ids(profile)
        if authz.has_permission(
            db, profile, pk.TASKS_MANAGE_COMMITTEE, committee_id=committee_id
        )
    }


def require_assignee_in_committee(
    db: Session, committee_id: uuid.UUID, assignee_user_id: uuid.UUID
) -> None:
    """A task may only be given to someone in the committee that owns it.

    `create_task` has always enforced this. `update_task` did not, so the rule
    could be walked straight around by listing a task unassigned and then
    patching an outsider onto it — who was then notified about work on a
    board they cannot see.
    """
    in_committee = db.scalar(
        select(CommitteeMembership.id).where(
            CommitteeMembership.user_id == assignee_user_id,
            CommitteeMembership.committee_id == committee_id,
        )
    )
    if in_committee is None:
        raise _invalid("That camper is not in this committee.")


def _require_committee_scope(
    db: Session,
    profile: Profile,
    committee_id: uuid.UUID,
    permission: str,
    *,
    org_wide: str,
) -> None:
    """Allow the org-wide key through, otherwise demand the committee itself.

    `org_wide` is the key that means "for any committee" — tasks.manage_all for
    board writes, requests.manage_all for the request flow. Passing the wrong
    one would let a head write where they should not, so it is explicit at
    every call site rather than defaulted.
    """
    if authz.has_permission(db, profile, org_wide):
        return
    if committee_id not in member_committee_ids(profile):
        raise authz.permission_denied(
            code="committee_scope_denied",
            message="You do not have access to this committee.",
        )
    authz.require_permission(db, profile, permission, committee_id=committee_id)


# ---------------------------------------------------------------------------
# Serialization
# ---------------------------------------------------------------------------


def _person(profile: Profile | None) -> dict | None:
    if profile is None:
        return None
    return {
        "id": str(profile.id),
        "name": profile.full_name or profile.email,
    }


def task_payload(task: Task) -> dict:
    event = task.event
    origin = task.origin_task
    from_committee = None
    if origin is not None and origin.committee is not None:
        from_committee = {
            "id": str(origin.committee_id),
            "name": origin.committee.name,
        }
    return {
        "id": str(task.id),
        "committeeId": str(task.committee_id),
        "title": task.title,
        "details": task.details,
        "status": task.status,
        "assignee": _person(task.assignee),
        "dueOn": task.due_on.isoformat() if task.due_on else None,
        "createdAt": task.created_at,
        "event": (
            {
                "id": str(event.id),
                "name": event.name,
                "slug": event.slug,
                "year": event.year,
            }
            if event is not None
            else None
        ),
        "originTaskId": str(task.origin_task_id) if task.origin_task_id else None,
        "fromCommittee": from_committee,
    }


def request_payload(request: CommitteeRequest) -> dict:
    return {
        "id": str(request.id),
        "requestingCommittee": {
            "id": str(request.requesting_committee_id),
            "name": request.requesting_committee.name,
        },
        "targetCommittee": {
            "id": str(request.target_committee_id),
            "name": request.target_committee.name,
        },
        "title": request.title,
        "details": request.details,
        "status": request.status,
        "dueOn": request.due_on.isoformat() if request.due_on else None,
        "sourceTaskId": str(request.source_task_id) if request.source_task_id else None,
        "createdBy": _person(request.created_by),
        "respondedBy": _person(request.responded_by),
        "respondedAt": request.responded_at,
        "createdAt": request.created_at,
    }


# ---------------------------------------------------------------------------
# The board
# ---------------------------------------------------------------------------


def board_payload(db: Session, profile: Profile) -> dict:
    """Every committee with its tasks, ordered for a left-to-right scan.

    One query per table rather than one per committee: a dozen committees on
    one page should not be a dozen round trips.

    Missing Leadership 2 committees are upserted here so a database that was
    seeded with only the first few columns still shows the full board.
    """
    authz.require_permission(db, profile, pk.TASKS_VIEW_ALL)

    from app.services.campers import ensure_roster_committees

    committee_counts = ensure_roster_committees(db)
    if committee_counts["committees_created"] or committee_counts["committees_updated"]:
        db.commit()

    committees = db.scalars(select(Committee).order_by(Committee.name)).all()
    tasks = db.scalars(
        select(Task)
        .options(
            selectinload(Task.assignee),
            selectinload(Task.event),
            selectinload(Task.origin_task).selectinload(Task.committee),
        )
        .order_by(Task.due_on.is_(None), Task.due_on, Task.created_at)
    ).all()
    open_requests = db.scalars(
        select(CommitteeRequest)
        .options(
            selectinload(CommitteeRequest.requesting_committee),
            selectinload(CommitteeRequest.target_committee),
            selectinload(CommitteeRequest.created_by),
            selectinload(CommitteeRequest.responded_by),
        )
        .where(CommitteeRequest.status.in_(REQUEST_OPEN_STATUSES))
        .order_by(CommitteeRequest.created_at.desc())
    ).all()

    by_committee: dict[uuid.UUID, list[Task]] = {}
    for task in tasks:
        by_committee.setdefault(task.committee_id, []).append(task)

    inbound: dict[uuid.UUID, int] = {}
    for request in open_requests:
        inbound[request.target_committee_id] = (
            inbound.get(request.target_committee_id, 0) + 1
        )

    mine = member_committee_ids(profile)
    writable = task_writable_committee_ids(db, profile)

    return {
        "committees": [
            {
                "id": str(committee.id),
                "name": committee.name,
                "slug": committee.slug,
                "isMine": committee.id in mine,
                "canAddTask": committee.id in writable,
                "openRequestCount": inbound.get(committee.id, 0),
                "tasks": [
                    task_payload(task) for task in by_committee.get(committee.id, [])
                ],
            }
            for committee in committees
        ]
    }


def _committee(db: Session, committee_id: uuid.UUID) -> Committee:
    committee = db.get(Committee, committee_id)
    if committee is None:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND, detail="Committee not found."
        )
    return committee


def _invalid(message: str) -> HTTPException:
    return HTTPException(
        status_code=http_status.HTTP_400_BAD_REQUEST, detail=message
    )


def _resolve_event(db: Session, event_id: uuid.UUID | None) -> Event | None:
    """Validate an optional event link. Calendar-only rows are not board work."""
    if event_id is None:
        return None
    event = db.get(Event, event_id)
    if event is None:
        raise _invalid("That event was not found.")
    if event.status == "calendar":
        raise _invalid("Calendar-only entries cannot be linked to board tasks.")
    return event


def create_task(
    db: Session,
    profile: Profile,
    *,
    committee_id: uuid.UUID,
    title: str,
    details: str = "",
    assignee_user_id: uuid.UUID | None = None,
    due_on: date | None = None,
    event_id: uuid.UUID | None = None,
    collaborator_committee_ids: list[uuid.UUID] | None = None,
) -> tuple[Task, list[CommitteeRequest]]:
    """Lists a task, and fans it out to the committees it needs.

    The fan-out is the point of the feature: the moment Fundraising books a
    fundraiser, Publicity has a request waiting — and a matching row on
    Publicity's own board — without anyone remembering to go and ask.
    """
    committee = _committee(db, committee_id)
    _require_committee_scope(
        db,
        profile,
        committee_id,
        pk.TASKS_MANAGE_COMMITTEE,
        org_wide=pk.TASKS_MANAGE_ALL,
    )

    clean_title = title.strip()
    if not clean_title:
        raise _invalid("A task needs a title.")

    if assignee_user_id is not None:
        require_assignee_in_committee(db, committee_id, assignee_user_id)

    event = _resolve_event(db, event_id)

    task = Task(
        committee_id=committee_id,
        title=clean_title,
        details=details.strip(),
        status="todo",
        assignee_user_id=assignee_user_id,
        due_on=due_on,
        event_id=event.id if event else None,
        created_by_user_id=profile.id,
    )
    db.add(task)
    db.flush()

    if assignee_user_id is not None and assignee_user_id != profile.id:
        assignee = db.get(Profile, assignee_user_id)
        assignee_name = _actor_label(assignee) if assignee else "a camper"
        actor = _actor_label(profile)
        notifications.deliver(
            db,
            recipient_ids=_activity_audience(
                db, committee_id, exclude=profile.id
            ),
            type="task.assigned",
            title=f"{actor} assigned “{task.title}” to {assignee_name}",
            body=committee.name,
            payload={"taskId": str(task.id), "committeeId": str(committee_id)},
        )

    fanned: list[CommitteeRequest] = []
    for target_id in dict.fromkeys(collaborator_committee_ids or []):
        if target_id == committee_id:
            # Asking yourself for help is the task itself.
            continue
        target = _committee(db, target_id)
        # Mirror onto the helper committee's board so the work is visible
        # where they work, not only in the requests log.
        mirror = Task(
            committee_id=target_id,
            title=task.title,
            details=task.details,
            status="todo",
            due_on=due_on,
            event_id=task.event_id,
            origin_task_id=task.id,
            created_by_user_id=profile.id,
        )
        db.add(mirror)
        fanned.append(
            _open_request(
                db,
                profile,
                requesting_committee=committee,
                target_committee=target,
                title=task.title,
                details=task.details,
                due_on=due_on,
                source_task=task,
            )
        )

    db.commit()
    db.refresh(task)
    # Payload needs event / origin relationships after commit.
    if task.event_id is not None:
        db.refresh(task, attribute_names=["event"])
    return task, fanned


def update_task(
    db: Session,
    profile: Profile,
    task_id: uuid.UUID,
    *,
    status: str | None = None,
    assignee_user_id: uuid.UUID | None = None,
    clear_assignee: bool = False,
) -> Task:
    task = db.get(Task, task_id)
    if task is None:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND, detail="Task not found."
        )

    _require_committee_scope(
        db,
        profile,
        task.committee_id,
        pk.TASKS_MANAGE_COMMITTEE,
        org_wide=pk.TASKS_MANAGE_ALL,
    )

    if status is not None:
        if status not in TASK_STATUSES:
            raise _invalid(f"Unknown task status: {status!r}.")
        task.status = status

    if clear_assignee:
        task.assignee_user_id = None
    elif assignee_user_id is not None and assignee_user_id != task.assignee_user_id:
        # Checked before the assignment and before the notification, so an
        # outsider is neither recorded as the owner nor told they are.
        require_assignee_in_committee(db, task.committee_id, assignee_user_id)
        task.assignee_user_id = assignee_user_id
        if assignee_user_id != profile.id:
            assignee = db.get(Profile, assignee_user_id)
            assignee_name = _actor_label(assignee) if assignee else "a camper"
            actor = _actor_label(profile)
            committee = db.get(Committee, task.committee_id)
            notifications.deliver(
                db,
                recipient_ids=_activity_audience(
                    db, task.committee_id, exclude=profile.id
                ),
                type="task.assigned",
                title=f"{actor} assigned “{task.title}” to {assignee_name}",
                body=committee.name if committee else "Committee",
                payload={
                    "taskId": str(task.id),
                    "committeeId": str(task.committee_id),
                },
            )

    task.updated_at = _now()
    db.commit()
    db.refresh(task)
    return task


# ---------------------------------------------------------------------------
# Requests
# ---------------------------------------------------------------------------


def _committee_members(db: Session, committee_id: uuid.UUID) -> list[uuid.UUID]:
    """Every camper in the committee — members and heads alike."""
    return list(
        db.scalars(
            select(CommitteeMembership.user_id).where(
                CommitteeMembership.committee_id == committee_id
            )
        ).all()
    )


def _asbo_user_ids(db: Session) -> list[uuid.UUID]:
    """ASBO / President see activity across every committee."""
    from app.models.rbac import Role, UserRoleAssignment

    return list(
        db.scalars(
            select(UserRoleAssignment.user_id)
            .join(Role, Role.id == UserRoleAssignment.role_id)
            .where(Role.slug.in_(("asbo", "president")))
        ).all()
    )


def _activity_audience(
    db: Session,
    *committee_ids: uuid.UUID,
    exclude: uuid.UUID | None = None,
) -> list[uuid.UUID]:
    """Who hears about committee work.

    Members and heads of the involved committees, plus every ASBO/President.
    The actor is dropped so you are not notified about your own click.
    """
    recipients: set[uuid.UUID] = set()
    for committee_id in dict.fromkeys(committee_ids):
        recipients.update(_committee_members(db, committee_id))
    recipients.update(_asbo_user_ids(db))
    if exclude is not None:
        recipients.discard(exclude)
    return list(recipients)


def _committee_recipients(db: Session, committee_id: uuid.UUID) -> list[uuid.UUID]:
    """Backward-compatible alias: whole committee, not heads-only."""
    return _committee_members(db, committee_id)


def _actor_label(profile: Profile) -> str:
    return (profile.full_name or "").strip() or (profile.email or "Someone")


def _open_request(
    db: Session,
    profile: Profile,
    *,
    requesting_committee: Committee,
    target_committee: Committee,
    title: str,
    details: str,
    due_on: date | None,
    source_task: Task | None = None,
) -> CommitteeRequest:
    """Writes one request row and tells both committees + ASBO about it."""
    request = CommitteeRequest(
        requesting_committee_id=requesting_committee.id,
        target_committee_id=target_committee.id,
        title=title,
        details=details,
        status="open",
        due_on=due_on,
        source_task_id=source_task.id if source_task else None,
        created_by_user_id=profile.id,
    )
    db.add(request)
    db.flush()

    actor = _actor_label(profile)
    notifications.deliver(
        db,
        recipient_ids=_activity_audience(
            db,
            requesting_committee.id,
            target_committee.id,
            exclude=profile.id,
        ),
        type="request.received",
        title=f"{actor} requested {title}",
        body=f"{requesting_committee.name} → {target_committee.name}",
        payload={"requestId": str(request.id)},
    )
    return request


def create_request(
    db: Session,
    profile: Profile,
    *,
    requesting_committee_id: uuid.UUID,
    target_committee_id: uuid.UUID,
    title: str,
    details: str = "",
    due_on: date | None = None,
) -> CommitteeRequest:
    authz.require_permission(db, profile, pk.REQUESTS_CREATE)
    _require_committee_scope(
        db,
        profile,
        requesting_committee_id,
        pk.REQUESTS_VIEW_OWN_COMMITTEE,
        org_wide=pk.REQUESTS_MANAGE_ALL,
    )

    if requesting_committee_id == target_committee_id:
        raise _invalid("A committee cannot file a request against itself.")

    clean_title = title.strip()
    if not clean_title:
        raise _invalid("A request needs a title.")

    request = _open_request(
        db,
        profile,
        requesting_committee=_committee(db, requesting_committee_id),
        target_committee=_committee(db, target_committee_id),
        title=clean_title,
        details=details.strip(),
        due_on=due_on,
    )
    db.commit()
    db.refresh(request)
    return request


#: What each answer is called when it lands in the requester's inbox.
_RESPONSE_NOTICE = {
    "accepted": ("request.accepted", "picked up"),
    "declined": ("request.declined", "declined"),
    "done": ("request.completed", "finished"),
}


def respond_to_request(
    db: Session, profile: Profile, request_id: uuid.UUID, *, status: str
) -> CommitteeRequest:
    """Moves a request along and tells the committee that asked.

    Only the target committee answers. The requester can see the row and chase
    it, but marking someone else's work done is not theirs to do.
    """
    request = db.get(CommitteeRequest, request_id)
    if request is None:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND, detail="Request not found."
        )

    if status not in REQUEST_STATUSES or status == "open":
        raise _invalid(f"Unknown request status: {status!r}.")

    _require_committee_scope(
        db,
        profile,
        request.target_committee_id,
        pk.REQUESTS_MANAGE_OWN_COMMITTEE,
        org_wide=pk.REQUESTS_MANAGE_ALL,
    )

    request.status = status
    request.responded_by_user_id = profile.id
    request.responded_at = _now()
    request.updated_at = _now()

    notice_type, verb = _RESPONSE_NOTICE[status]
    actor = _actor_label(profile)
    notifications.deliver(
        db,
        recipient_ids=_activity_audience(
            db,
            request.requesting_committee_id,
            request.target_committee_id,
            exclude=profile.id,
        ),
        type=notice_type,
        title=f"{actor} {verb} “{request.title}”",
        body=f"{request.target_committee.name} → {request.requesting_committee.name}",
        payload={"requestId": str(request.id)},
    )

    db.commit()
    db.refresh(request)
    return request


def _request_query():
    return select(CommitteeRequest).options(
        selectinload(CommitteeRequest.requesting_committee),
        selectinload(CommitteeRequest.target_committee),
        selectinload(CommitteeRequest.created_by),
        selectinload(CommitteeRequest.responded_by),
    )


def list_all_requests(db: Session, profile: Profile) -> dict:
    """The cross-org log behind /requests."""
    authz.require_permission(db, profile, pk.REQUESTS_VIEW_ALL)
    requests = db.scalars(
        _request_query().order_by(CommitteeRequest.created_at.desc())
    ).all()
    return {"requests": [request_payload(r) for r in requests]}


def list_my_requests(db: Session, profile: Profile) -> dict:
    """Inbound and outbound for the caller's own committees.

    This is what the dashboard widget renders, and it is the only request view
    a regular member ever sees.
    """
    # requests.view_own_committee is committee-scoped, so it is checked once
    # per committee the caller belongs to rather than globally — an unscoped
    # check of a scoped key always fails.
    mine = {
        committee_id
        for committee_id in member_committee_ids(profile)
        if authz.has_permission(
            db, profile, pk.REQUESTS_VIEW_OWN_COMMITTEE, committee_id=committee_id
        )
    }
    if not mine:
        return {"inbound": [], "outbound": [], "committees": []}

    requests = db.scalars(
        _request_query()
        .where(
            or_(
                CommitteeRequest.target_committee_id.in_(mine),
                CommitteeRequest.requesting_committee_id.in_(mine),
            )
        )
        .order_by(CommitteeRequest.created_at.desc())
    ).all()

    return {
        "inbound": [
            request_payload(r) for r in requests if r.target_committee_id in mine
        ],
        "outbound": [
            request_payload(r)
            for r in requests
            if r.requesting_committee_id in mine and r.target_committee_id not in mine
        ],
        "committees": [
            {"id": str(c.id), "name": c.name}
            for c in db.scalars(
                select(Committee).where(Committee.id.in_(mine)).order_by(Committee.name)
            ).all()
        ],
    }
