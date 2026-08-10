"""Messenger Agenda HTTP API."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Request, Response
from pydantic import BaseModel, Field

from app.api.deps import CurrentProfile, DbSession
from app.core.config import settings
from app.services.messenger_agenda import service as messenger_agenda

router = APIRouter(prefix="/messenger-agenda", tags=["messenger-agenda"])


class CreateSessionBody(BaseModel):
    title: str | None = Field(default=None, max_length=200)
    source: str = "paste"
    threadId: str | None = None
    threadLabel: str | None = None
    startKeyword: str | None = None
    endKeyword: str | None = None


class IngestBody(BaseModel):
    rawText: str = Field(min_length=0)
    append: bool = False


class ConnectBody(BaseModel):
    grantedThreadIds: list[str] = Field(default_factory=list)


class AttachPlanBody(BaseModel):
    planId: str = Field(min_length=1, max_length=80)


@router.get("/connection")
def read_connection(profile: CurrentProfile, db: DbSession) -> dict:
    return messenger_agenda.get_connection(db, profile)


@router.post("/connection/connect")
def connect(body: ConnectBody, profile: CurrentProfile, db: DbSession) -> dict:
    return messenger_agenda.connect_messenger(
        db, profile, granted_thread_ids=body.grantedThreadIds or None
    )


@router.post("/connection/disconnect")
def disconnect(profile: CurrentProfile, db: DbSession) -> dict:
    return messenger_agenda.disconnect_messenger(db, profile)


@router.get("/sessions")
def list_sessions(profile: CurrentProfile, db: DbSession) -> dict:
    sessions = messenger_agenda.list_sessions(db, profile)
    return {
        "sessions": [messenger_agenda.session_to_dict(item) for item in sessions]
    }


@router.post("/sessions", status_code=201)
def create_session(body: CreateSessionBody, profile: CurrentProfile, db: DbSession) -> dict:
    session = messenger_agenda.create_session(
        db,
        profile,
        title=body.title,
        source=body.source,
        thread_id=body.threadId,
        thread_label=body.threadLabel,
        start_keyword=body.startKeyword,
        end_keyword=body.endKeyword,
    )
    return messenger_agenda.session_to_dict(session)


@router.get("/sessions/{session_id}")
def read_session(
    session_id: uuid.UUID, profile: CurrentProfile, db: DbSession
) -> dict:
    session = messenger_agenda.get_session(db, profile, session_id)
    return messenger_agenda.session_to_dict(session)


@router.post("/sessions/{session_id}/start")
def start_capture(
    session_id: uuid.UUID, profile: CurrentProfile, db: DbSession
) -> dict:
    session = messenger_agenda.start_capture(db, profile, session_id)
    return messenger_agenda.session_to_dict(session)


@router.post("/sessions/{session_id}/ingest")
def ingest(
    session_id: uuid.UUID,
    body: IngestBody,
    profile: CurrentProfile,
    db: DbSession,
) -> dict:
    session = messenger_agenda.ingest_text(
        db, profile, session_id, raw_text=body.rawText, append=body.append
    )
    return messenger_agenda.session_to_dict(session)


@router.post("/sessions/{session_id}/finalize")
def finalize(
    session_id: uuid.UUID, profile: CurrentProfile, db: DbSession
) -> dict:
    session = messenger_agenda.finalize(db, profile, session_id)
    return messenger_agenda.session_to_dict(session)


@router.post("/sessions/{session_id}/assignments/generate")
def generate_assignments(
    session_id: uuid.UUID, profile: CurrentProfile, db: DbSession
) -> dict:
    session = messenger_agenda.generate_assignments(db, profile, session_id)
    return messenger_agenda.session_to_dict(session)


@router.post("/sessions/{session_id}/attach-plan")
def attach_plan(
    session_id: uuid.UUID,
    body: AttachPlanBody,
    profile: CurrentProfile,
    db: DbSession,
) -> dict:
    session = messenger_agenda.attach_plan_id(
        db, profile, session_id, plan_id=body.planId
    )
    return messenger_agenda.session_to_dict(session)


@router.get("/webhooks/messenger")
def verify_messenger_webhook(
    request: Request,
) -> Response:
    """Meta webhook verification handshake."""
    params = request.query_params
    mode = params.get("hub.mode")
    token = params.get("hub.verify_token")
    challenge = params.get("hub.challenge", "")
    expected = getattr(settings, "meta_webhook_verify_token", "") or ""
    if mode == "subscribe" and expected and token == expected:
        return Response(content=challenge, media_type="text/plain")
    return Response(status_code=403, content="Forbidden")


@router.post("/webhooks/messenger")
async def messenger_webhook(request: Request) -> dict:
    """Receive Messenger page events.

    Acknowledges Meta's webhook handshake with a fast 200. Binding inbound
    messages into capturing sessions lands when a Page token is configured.
    """
    try:
        payload = await request.json()
    except ValueError:
        return {"ok": False}
    _ = payload
    return {"ok": True}
