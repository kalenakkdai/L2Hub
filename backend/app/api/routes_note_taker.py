"""Note Taker HTTP API."""

from __future__ import annotations

import logging
import uuid
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, File, Form, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field

from app.api.deps import CurrentProfile, DbSession, Storage
from app.core import permission_keys as pk
from app.db.session import SessionLocal
from app.services import authorization as authz
from app.services.note_taker import service as note_taker
from app.storage.factory import get_storage_singleton

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/note-taker", tags=["note-taker"])


class CreateSessionBody(BaseModel):
    """`title` may be omitted to accept the auto-generated document name."""

    title: str | None = Field(default=None, max_length=200)
    eventId: uuid.UUID | None = None


class RenameSessionBody(BaseModel):
    title: str = Field(min_length=1, max_length=200)


def _process_in_background(session_id: uuid.UUID) -> None:
    """Open a fresh DB session — the request session is already closed."""
    db = SessionLocal()
    try:
        note_taker.process_session(db, get_storage_singleton(), session_id)
    except Exception:
        # process_session already marks the row failed; log and return so
        # BackgroundTasks does not surface an unhandled ASGI error.
        logger.exception("Note Taker processing failed for session %s", session_id)
    finally:
        db.close()


@router.get("/sessions")
def list_sessions(
    profile: CurrentProfile,
    db: DbSession,
    eventId: uuid.UUID | None = None,
) -> dict:
    sessions = note_taker.list_sessions(db, profile, event_id=eventId)
    return {"sessions": [note_taker.session_to_dict(item) for item in sessions]}


@router.get("/suggested-title")
def suggested_title(
    profile: CurrentProfile,
    db: DbSession,
    eventId: uuid.UUID | None = None,
) -> dict:
    """Name the record button would use, so the UI can show it up front."""
    authz.require_permission(db, profile, pk.NOTE_TAKER_RECORD)
    return {"title": note_taker.auto_title(db, event_id=eventId)}


@router.post("/sessions", status_code=201)
def create_session(body: CreateSessionBody, profile: CurrentProfile, db: DbSession) -> dict:
    session = note_taker.create_session(
        db, profile, title=body.title, event_id=body.eventId
    )
    return note_taker.session_to_dict(session)


@router.patch("/sessions/{session_id}")
def rename_session(
    session_id: uuid.UUID,
    body: RenameSessionBody,
    profile: CurrentProfile,
    db: DbSession,
) -> dict:
    session = note_taker.rename_session(db, profile, session_id, title=body.title)
    return note_taker.session_to_dict(session)


@router.get("/sessions/{session_id}")
def get_session(session_id: uuid.UUID, profile: CurrentProfile, db: DbSession) -> dict:
    session = note_taker.get_session(db, profile, session_id)
    return note_taker.session_to_dict(session)


@router.post("/sessions/{session_id}/audio")
async def upload_audio(
    session_id: uuid.UUID,
    profile: CurrentProfile,
    db: DbSession,
    storage: Storage,
    background_tasks: BackgroundTasks,
    file: Annotated[UploadFile, File()],
    durationMs: Annotated[int | None, Form()] = None,
    transcriptFullText: Annotated[str | None, Form()] = None,
    transcriptSegmentsJson: Annotated[str | None, Form()] = None,
    transcriptLanguage: Annotated[str | None, Form()] = None,
    transcriptProvider: Annotated[str | None, Form()] = None,
) -> dict:
    audio_bytes = await file.read()
    session = note_taker.store_audio_and_queue(
        db,
        profile,
        storage,
        session_id,
        audio_bytes=audio_bytes,
        content_type=file.content_type,
        duration_ms=durationMs,
        transcript_full_text=transcriptFullText,
        transcript_segments_json=transcriptSegmentsJson,
        transcript_language=transcriptLanguage,
        transcript_provider=transcriptProvider,
    )
    background_tasks.add_task(_process_in_background, session_id)
    return note_taker.session_to_dict(session)


@router.post("/sessions/{session_id}/events/{event_id}", status_code=200)
def link_session_event(
    session_id: uuid.UUID,
    event_id: uuid.UUID,
    profile: CurrentProfile,
    db: DbSession,
) -> dict:
    session = note_taker.link_session_to_event(db, profile, session_id, event_id)
    return note_taker.session_to_dict(session)


@router.delete("/sessions/{session_id}/events/{event_id}")
def unlink_session_event(
    session_id: uuid.UUID,
    event_id: uuid.UUID,
    profile: CurrentProfile,
    db: DbSession,
) -> dict:
    session = note_taker.unlink_session_from_event(db, profile, session_id, event_id)
    return note_taker.session_to_dict(session)


@router.get("/sessions/{session_id}/transcript")
def get_transcript(session_id: uuid.UUID, profile: CurrentProfile, db: DbSession) -> dict:
    session = note_taker.get_session(db, profile, session_id)
    if session.transcript is None:
        return {"fullText": "", "segments": [], "language": None, "provider": None}
    return note_taker.transcript_to_dict(session.transcript)


@router.get("/sessions/{session_id}/note")
def get_note(session_id: uuid.UUID, profile: CurrentProfile, db: DbSession) -> dict:
    session = note_taker.get_session(db, profile, session_id)
    if session.note is None:
        return {"title": session.title, "summary": "", "sections": []}
    return note_taker.note_to_dict(session.note)


@router.get("/sessions/{session_id}/audio")
def download_audio(
    session_id: uuid.UUID, profile: CurrentProfile, db: DbSession, storage: Storage
) -> Response:
    data, content_type = note_taker.get_audio_bytes(db, profile, storage, session_id)
    return Response(
        content=data,
        media_type=content_type,
        headers={"Content-Disposition": 'inline; filename="meeting-audio"'},
    )
