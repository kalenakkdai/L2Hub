"""Events and Event Summary / Wrapped API routes."""

from __future__ import annotations

import json
import uuid

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import CurrentProfile, DbSession
from app.core import permission_keys as pk
from app.models import DebriefParticipant, Event, EventAgenda
from app.services import authorization as authz
from app.services import notifications
from app.services.event_summary import service as summary_service

router = APIRouter(tags=["events"])


class RequestBody(BaseModel):
    note: str | None = None


def _get_event(db: DbSession, event_ref: str) -> Event:
    event_uuid = _maybe_uuid(event_ref)
    query = select(Event).options(
        selectinload(Event.summary), selectinload(Event.debrief_participants)
    )
    if event_uuid is not None:
        event = db.scalar(query.where(Event.id == event_uuid))
    else:
        event = db.scalar(query.where(Event.slug == event_ref))
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found.")
    return event


def _maybe_uuid(value: str) -> uuid.UUID | None:
    try:
        return uuid.UUID(value)
    except ValueError:
        return None


@router.get("/events")
def list_events(profile: CurrentProfile, db: DbSession) -> dict:
    authz.require_permission(db, profile, pk.EVENTS_VIEW)
    events = db.scalars(
        select(Event).options(selectinload(Event.summary)).order_by(Event.year.desc())
    ).all()
    return {"events": [summary_service.event_list_item(event) for event in events]}


@router.get("/events/{event_ref}")
def get_event(event_ref: str, profile: CurrentProfile, db: DbSession) -> dict:
    authz.require_permission(db, profile, pk.EVENTS_VIEW)
    event = _get_event(db, event_ref)
    item = summary_service.event_list_item(event)
    item["canRequest"] = summary_service.can_manage_event_request(db, profile, event)
    item["canApprove"] = authz.has_permission(db, profile, pk.WRAPPED_APPROVE)
    item["canGenerate"] = authz.has_permission(db, profile, pk.WRAPPED_GENERATE)
    item["canPublish"] = authz.has_permission(db, profile, pk.WRAPPED_PUBLISH)
    item["canPresent"] = authz.has_permission(db, profile, pk.WRAPPED_PRESENT)
    return item


@router.post("/events/{event_ref}/summary/request")
def request_summary(
    event_ref: str, profile: CurrentProfile, db: DbSession, body: RequestBody | None = None
) -> dict:
    event = _get_event(db, event_ref)
    request = summary_service.request_summary(
        db, profile, event, note=body.note if body else None
    )
    return {
        "id": str(request.id),
        "status": request.status,
        "eventId": str(event.id),
        "summaryStatus": event.summary.status if event.summary else "pending_approval",
    }


@router.post("/events/{event_ref}/summary/approve")
def approve_summary(event_ref: str, profile: CurrentProfile, db: DbSession) -> dict:
    event = _get_event(db, event_ref)
    summary = summary_service.approve_and_generate(db, profile, event)
    return summary_service.generation_status_payload(summary)


@router.post("/events/{event_ref}/summary/reject")
def reject_summary(
    event_ref: str, profile: CurrentProfile, db: DbSession, body: RequestBody | None = None
) -> dict:
    event = _get_event(db, event_ref)
    summary = summary_service.reject_summary(
        db, profile, event, note=body.note if body else None
    )
    return {"status": summary.status}


@router.post("/events/{event_ref}/summary/generate")
def generate_summary(event_ref: str, profile: CurrentProfile, db: DbSession) -> dict:
    event = _get_event(db, event_ref)
    summary = summary_service.run_generation(db, profile, event)
    return summary_service.generation_status_payload(summary)


@router.get("/events/{event_ref}/summary/status")
def summary_status(event_ref: str, profile: CurrentProfile, db: DbSession) -> dict:
    event = _get_event(db, event_ref)
    summary = summary_service.get_or_create_summary(db, event)
    # Viewers who can request/approve/generate may poll status.
    if not (
        authz.has_permission(db, profile, pk.WRAPPED_GENERATE)
        or authz.has_permission(db, profile, pk.WRAPPED_REQUEST)
        or authz.has_permission(db, profile, pk.WRAPPED_APPROVE)
    ):
        raise authz.permission_denied()
    return summary_service.generation_status_payload(summary)


@router.post("/events/{event_ref}/summary/publish")
def publish_summary(event_ref: str, profile: CurrentProfile, db: DbSession) -> dict:
    event = _get_event(db, event_ref)
    summary = summary_service.publish_summary(db, profile, event)
    return {"status": summary.status, "publishedAt": summary.published_at}


@router.get("/events/{event_ref}/wrapped")
def get_wrapped(event_ref: str, profile: CurrentProfile, db: DbSession) -> dict:
    event = _get_event(db, event_ref)
    summary = summary_service.ensure_can_view_wrapped(db, profile, event)
    if not summary.payload_json:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Wrapped payload is not available yet.",
        )
    payload = json.loads(summary.payload_json)
    return {
        "event": summary_service.event_list_item(event),
        "status": summary.status,
        "wrapped": payload["wrapped"],
        "graph": payload["graph"],
        "executiveSummary": payload["executiveSummary"],
    }


@router.post("/events/{event_ref}/wrapped/presented")
def mark_wrapped_presented(event_ref: str, profile: CurrentProfile, db: DbSession) -> dict:
    event = _get_event(db, event_ref)
    summary = summary_service.mark_presented(db, profile, event)
    return {
        "status": summary.status,
        "presentedAt": summary.presented_at,
    }


@router.get("/events/{event_ref}/recap")
def get_wrapped_recap(event_ref: str, profile: CurrentProfile, db: DbSession) -> dict:
    event = _get_event(db, event_ref)
    summary = summary_service.ensure_can_view_recap(db, profile, event)
    return summary_service.build_recap(event, summary)


@router.get("/events/{event_ref}/agenda")
def get_agenda(event_ref: str, profile: CurrentProfile, db: DbSession) -> dict:
    event = _get_event(db, event_ref)
    if not (
        authz.has_permission(db, profile, pk.AGENDA_GENERATE)
        or authz.has_permission(db, profile, pk.AGENDA_VIEW_ALL)
        or authz.has_permission(db, profile, pk.WRAPPED_GENERATE)
    ):
        raise authz.permission_denied()
    agenda = db.scalars(
        select(EventAgenda)
        .where(EventAgenda.event_id == event.id)
        .order_by(EventAgenda.created_at.desc())
    ).first()
    if agenda is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agenda not found.")
    return {
        "id": str(agenda.id),
        "status": agenda.status,
        "content": json.loads(agenda.content_json),
    }


@router.post("/events/{event_ref}/agenda/generate")
def generate_agenda(event_ref: str, profile: CurrentProfile, db: DbSession) -> dict:
    authz.require_permission(db, profile, pk.AGENDA_GENERATE)
    event = _get_event(db, event_ref)
    summary = summary_service.get_or_create_summary(db, event)
    if not summary.payload_json:
        summary = summary_service.run_generation(db, profile, event)
    payload = json.loads(summary.payload_json or "{}")
    agenda = EventAgenda(
        event_id=event.id,
        summary_id=summary.id,
        content_json=json.dumps(payload.get("agenda", {})),
        status="draft",
    )
    db.add(agenda)
    db.commit()
    db.refresh(agenda)
    return {
        "id": str(agenda.id),
        "status": agenda.status,
        "content": json.loads(agenda.content_json),
    }


@router.get("/events/{event_ref}/live")
def live_participants(event_ref: str, profile: CurrentProfile, db: DbSession) -> dict:
    if not (
        authz.has_permission(db, profile, pk.DEBRIEF_VIEW_ALL)
        or authz.has_permission(db, profile, pk.ATTENDANCE_VIEW_ALL)
        or authz.has_permission(db, profile, pk.WRAPPED_GENERATE)
    ):
        raise authz.permission_denied()
    event = _get_event(db, event_ref)
    participants = db.scalars(
        select(DebriefParticipant).where(DebriefParticipant.event_id == event.id)
    ).all()
    return {
        "eventId": str(event.id),
        "participants": [
            {
                "id": str(p.id),
                "displayName": p.display_name,
                "status": p.status,
                "submittedAt": p.submitted_at,
            }
            for p in participants
        ],
    }


@router.post("/notifications/read")
def mark_notifications_read(profile: CurrentProfile, db: DbSession) -> dict:
    """Marks every unread notification read for the caller."""
    authz.require_permission(db, profile, pk.NOTIFICATIONS_VIEW_OWN)
    changed = notifications.mark_all_read(db, profile.id)
    db.commit()
    return {"markedRead": changed, "unread": notifications.unread_count(db, profile.id)}


@router.post("/notifications/{notification_id}/read")
def mark_notification_read(
    notification_id: uuid.UUID, profile: CurrentProfile, db: DbSession
) -> dict:
    """Marks one notification read.

    Scoped to the caller in the query itself, so an id belonging to someone
    else simply matches nothing rather than needing a separate ownership check.
    """
    authz.require_permission(db, profile, pk.NOTIFICATIONS_VIEW_OWN)
    changed = notifications.mark_read(db, profile.id, notification_id)
    db.commit()
    return {"markedRead": changed, "unread": notifications.unread_count(db, profile.id)}


@router.get("/notifications")
def list_notifications(profile: CurrentProfile, db: DbSession) -> dict:
    authz.require_permission(db, profile, pk.NOTIFICATIONS_VIEW_OWN)
    from app.models import Notification

    notes = db.scalars(
        select(Notification)
        .where(Notification.recipient_user_id == profile.id)
        .order_by(Notification.created_at.desc())
        .limit(50)
    ).all()
    return {
        "unread": notifications.unread_count(db, profile.id),
        "notifications": [
            {
                "id": str(n.id),
                "type": n.type,
                "title": n.title,
                "body": n.body,
                "payload": json.loads(n.payload_json) if n.payload_json else None,
                "readAt": n.read_at,
                "createdAt": n.created_at,
            }
            for n in notes
        ]
    }
