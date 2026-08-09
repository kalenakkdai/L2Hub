"""Note Taker application service."""

from __future__ import annotations

import json
import uuid
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.core import permission_keys as pk
from app.models.event_summary import Event
from app.models.note_taker import (
    MeetingNote,
    MeetingSession,
    MeetingSessionEventLink,
    MeetingTranscript,
)
from app.models.profile import Profile
from app.services import authorization as authz
from app.services.note_taker.naming import MAX_TITLE_LENGTH, suggest_meeting_title
from app.services.note_taker.notes import generate_meeting_note
from app.services.note_taker.whisper import get_transcriber
from app.storage.protocol import ObjectStorage, opaque_storage_key


def _now() -> datetime:
    return datetime.now(UTC)


def _can_manage(db: Session, profile: Profile) -> bool:
    return authz.has_permission(db, profile, pk.NOTE_TAKER_MANAGE)


def _require_session_access(
    db: Session, profile: Profile, session: MeetingSession
) -> None:
    if session.created_by == profile.id:
        return
    if _can_manage(db, profile):
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail={
            "code": "permission_denied",
            "message": "You do not have permission to access this meeting.",
        },
    )


def _sections_payload(note) -> list[dict]:
    return [
        {"title": section.title, "bullets": list(section.bullets)}
        for section in note.sections
    ]


def next_sequence_for_event(db: Session, event_id: uuid.UUID | None) -> int:
    """1-based position of the next meeting recorded against this event."""
    query = select(func.count()).select_from(MeetingSession)
    if event_id is None:
        query = query.where(MeetingSession.event_id.is_(None))
    else:
        query = query.where(MeetingSession.event_id == event_id)
    return int(db.scalar(query) or 0) + 1


def auto_title(
    db: Session, *, event_id: uuid.UUID | None, when: datetime | None = None
) -> str:
    """Suggested document name for a new meeting on this event."""
    event_name: str | None = None
    if event_id is not None:
        event = db.get(Event, event_id)
        if event is not None:
            event_name = f"{event.name} {event.year}"
    return suggest_meeting_title(
        event_name=event_name,
        sequence=next_sequence_for_event(db, event_id),
        when=when or _now(),
    )


def create_session(
    db: Session,
    profile: Profile,
    *,
    title: str | None = None,
    event_id: uuid.UUID | None = None,
) -> MeetingSession:
    authz.require_permission(db, profile, pk.NOTE_TAKER_RECORD)
    cleaned = (title or "").strip()
    # An empty title is the signal to auto-generate; the owner renames later.
    if not cleaned:
        cleaned = auto_title(db, event_id=event_id)
    session = MeetingSession(
        id=uuid.uuid4(),
        created_by=profile.id,
        title=cleaned[:MAX_TITLE_LENGTH],
        status="recording",
        event_id=event_id,
        started_at=_now(),
        created_at=_now(),
        updated_at=_now(),
    )
    db.add(session)
    # Record-time filing also places the log under that fire (reusable later).
    if event_id is not None:
        db.add(
            MeetingSessionEventLink(
                id=uuid.uuid4(),
                session_id=session.id,
                event_id=event_id,
                linked_by=profile.id,
                created_at=_now(),
            )
        )
    db.commit()
    db.refresh(session)
    return session


def rename_session(
    db: Session, profile: Profile, session_id: uuid.UUID, *, title: str
) -> MeetingSession:
    """Rename a meeting document. Owner, or anyone with manage."""
    authz.require_permission(db, profile, pk.NOTE_TAKER_VIEW)
    cleaned = title.strip()
    if not cleaned:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A meeting name cannot be empty.",
        )
    session = db.get(MeetingSession, session_id)
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found.")
    _require_session_access(db, profile, session)
    session.title = cleaned[:MAX_TITLE_LENGTH]
    session.updated_at = _now()
    db.commit()
    db.refresh(session)
    return session


def list_sessions(
    db: Session, profile: Profile, *, event_id: uuid.UUID | None = None
) -> list[MeetingSession]:
    authz.require_permission(db, profile, pk.NOTE_TAKER_VIEW)
    query = select(MeetingSession).options(
        selectinload(MeetingSession.note),
        selectinload(MeetingSession.transcript),
        selectinload(MeetingSession.event_links),
    )
    if not _can_manage(db, profile):
        query = query.where(MeetingSession.created_by == profile.id)
    if event_id is not None:
        # Campfire membership: explicit link OR legacy record-time filing.
        linked_ids = select(MeetingSessionEventLink.session_id).where(
            MeetingSessionEventLink.event_id == event_id
        )
        query = query.where(
            (MeetingSession.event_id == event_id) | MeetingSession.id.in_(linked_ids)
        )
    query = query.order_by(MeetingSession.created_at.desc())
    return list(db.scalars(query).unique().all())


def link_session_to_event(
    db: Session,
    profile: Profile,
    session_id: uuid.UUID,
    event_id: uuid.UUID,
) -> MeetingSession:
    """Place a meeting log under an event fire. Idempotent."""
    authz.require_permission(db, profile, pk.NOTE_TAKER_RECORD)
    session = db.get(
        MeetingSession,
        session_id,
        options=(
            selectinload(MeetingSession.note),
            selectinload(MeetingSession.transcript),
            selectinload(MeetingSession.event_links),
        ),
    )
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found.")
    _require_session_access(db, profile, session)

    event = db.get(Event, event_id)
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found.")

    existing = db.scalar(
        select(MeetingSessionEventLink).where(
            MeetingSessionEventLink.session_id == session_id,
            MeetingSessionEventLink.event_id == event_id,
        )
    )
    if existing is None:
        db.add(
            MeetingSessionEventLink(
                id=uuid.uuid4(),
                session_id=session_id,
                event_id=event_id,
                linked_by=profile.id,
                created_at=_now(),
            )
        )
        session.updated_at = _now()
        db.commit()

    db.expire_all()
    refreshed = db.get(
        MeetingSession,
        session_id,
        options=(
            selectinload(MeetingSession.note),
            selectinload(MeetingSession.transcript),
            selectinload(MeetingSession.event_links),
        ),
    )
    assert refreshed is not None
    return refreshed


def unlink_session_from_event(
    db: Session,
    profile: Profile,
    session_id: uuid.UUID,
    event_id: uuid.UUID,
) -> MeetingSession:
    """Remove a log from a fire without deleting the meeting."""
    authz.require_permission(db, profile, pk.NOTE_TAKER_RECORD)
    session = db.get(MeetingSession, session_id)
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found.")
    _require_session_access(db, profile, session)

    link = db.scalar(
        select(MeetingSessionEventLink).where(
            MeetingSessionEventLink.session_id == session_id,
            MeetingSessionEventLink.event_id == event_id,
        )
    )
    if link is not None:
        db.delete(link)
        if session.event_id == event_id:
            session.event_id = None
        session.updated_at = _now()
        db.commit()

    db.expire_all()
    refreshed = db.get(
        MeetingSession,
        session_id,
        options=(
            selectinload(MeetingSession.note),
            selectinload(MeetingSession.transcript),
            selectinload(MeetingSession.event_links),
        ),
    )
    assert refreshed is not None
    return refreshed


def get_session(db: Session, profile: Profile, session_id: uuid.UUID) -> MeetingSession:
    authz.require_permission(db, profile, pk.NOTE_TAKER_VIEW)
    session = db.get(
        MeetingSession,
        session_id,
        options=(
            selectinload(MeetingSession.note),
            selectinload(MeetingSession.transcript),
            selectinload(MeetingSession.event_links),
        ),
    )
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found.")
    _require_session_access(db, profile, session)
    return session


def store_audio_and_queue(
    db: Session,
    profile: Profile,
    storage: ObjectStorage,
    session_id: uuid.UUID,
    *,
    audio_bytes: bytes,
    content_type: str | None,
    duration_ms: int | None,
    transcript_full_text: str | None = None,
    transcript_segments_json: str | None = None,
    transcript_language: str | None = None,
    transcript_provider: str | None = None,
) -> MeetingSession:
    authz.require_permission(db, profile, pk.NOTE_TAKER_RECORD)
    session = db.get(MeetingSession, session_id)
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found.")
    if session.created_by != profile.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "permission_denied",
                "message": "Only the owner can upload audio for this meeting.",
            },
        )
    if session.status in {"processing", "ready"}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This meeting already has audio processing or is ready.",
        )
    if not audio_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Audio file is empty.")

    extension = "webm"
    if content_type:
        lowered = content_type.split(";")[0].strip().lower()
        extension = {
            "audio/webm": "webm",
            "audio/wav": "wav",
            "audio/x-wav": "wav",
            "audio/mpeg": "mp3",
            "audio/mp4": "m4a",
            "audio/ogg": "ogg",
        }.get(lowered, "webm")

    key = opaque_storage_key(namespace="note-taker", extension=extension)
    stored = storage.put(key, audio_bytes, content_type=content_type or "audio/webm")

    session.audio_storage_key = stored.key
    session.audio_content_type = content_type or "audio/webm"
    session.audio_size_bytes = stored.size_bytes
    session.duration_ms = duration_ms
    session.status = "processing"
    session.ended_at = _now()
    session.updated_at = _now()
    session.error_message = None

    # Prefer the browser Web Speech transcript when the client sends one.
    cleaned = (transcript_full_text or "").strip()
    if cleaned:
        segments_json = transcript_segments_json or "[]"
        try:
            parsed = json.loads(segments_json)
            if not isinstance(parsed, list):
                raise ValueError("segments must be a list")
        except (TypeError, ValueError, json.JSONDecodeError) as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="transcriptSegmentsJson must be a JSON array.",
            ) from exc
        provider = (transcript_provider or "chrome-web-speech").strip() or "chrome-web-speech"
        existing = db.get(MeetingTranscript, session_id)
        if existing is None:
            db.add(
                MeetingTranscript(
                    session_id=session_id,
                    full_text=cleaned,
                    segments_json=json.dumps(parsed),
                    language=transcript_language,
                    provider=provider,
                    created_at=_now(),
                )
            )
        else:
            existing.full_text = cleaned
            existing.segments_json = json.dumps(parsed)
            existing.language = transcript_language
            existing.provider = provider

    db.commit()
    db.refresh(session)
    return session


def process_session(
    db: Session,
    storage: ObjectStorage,
    session_id: uuid.UUID,
) -> MeetingSession:
    """Build notes from a browser transcript, or fall back to Whisper."""
    session = db.get(MeetingSession, session_id)
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found.")
    if not session.audio_storage_key:
        session.status = "failed"
        session.error_message = "No audio was stored for this meeting."
        session.updated_at = _now()
        db.commit()
        return session

    try:
        existing_transcript = db.get(MeetingTranscript, session_id)
        if existing_transcript is not None and existing_transcript.full_text.strip():
            full_text = existing_transcript.full_text
            language = existing_transcript.language
            provider = existing_transcript.provider or "chrome-web-speech"
            segments_json = existing_transcript.segments_json
        else:
            audio_bytes = storage.get(session.audio_storage_key)
            result = get_transcriber().transcribe(
                audio_bytes, content_type=session.audio_content_type
            )
            full_text = result.full_text
            language = result.language
            provider = result.provider
            segments_json = json.dumps(
                [
                    {
                        "startMs": segment.start_ms,
                        "endMs": segment.end_ms,
                        "text": segment.text,
                    }
                    for segment in result.segments
                ]
            )
            if existing_transcript is None:
                db.add(
                    MeetingTranscript(
                        session_id=session_id,
                        full_text=full_text,
                        segments_json=segments_json,
                        language=language,
                        provider=provider,
                        created_at=_now(),
                    )
                )
            else:
                existing_transcript.full_text = full_text
                existing_transcript.segments_json = segments_json
                existing_transcript.language = language
                existing_transcript.provider = provider

        generated = generate_meeting_note(
            session_title=session.title, transcript=full_text
        )

        existing_note = db.get(MeetingNote, session_id)
        sections_json = json.dumps(_sections_payload(generated))
        if existing_note is None:
            db.add(
                MeetingNote(
                    session_id=session_id,
                    title=generated.title,
                    summary=generated.summary,
                    sections_json=sections_json,
                    created_at=_now(),
                    updated_at=_now(),
                )
            )
        else:
            existing_note.title = generated.title
            existing_note.summary = generated.summary
            existing_note.sections_json = sections_json
            existing_note.updated_at = _now()

        session.status = "ready"
        session.error_message = None
        session.updated_at = _now()
        db.commit()
    except Exception as exc:
        db.rollback()
        session = db.get(MeetingSession, session_id)
        if session is not None:
            session.status = "failed"
            session.error_message = "Could not draft the meeting note from the transcript."
            session.updated_at = _now()
            db.commit()
        raise RuntimeError(str(exc)) from exc

    refreshed = db.get(
        MeetingSession,
        session_id,
        options=(
            selectinload(MeetingSession.note),
            selectinload(MeetingSession.transcript),
        ),
    )
    assert refreshed is not None
    return refreshed


def get_audio_bytes(
    db: Session, profile: Profile, storage: ObjectStorage, session_id: uuid.UUID
) -> tuple[bytes, str]:
    session = get_session(db, profile, session_id)
    if not session.audio_storage_key:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No audio for this meeting.")
    try:
        data = storage.get(session.audio_storage_key)
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Audio file is missing from storage."
        ) from exc
    return data, session.audio_content_type or "application/octet-stream"


def session_to_dict(session: MeetingSession) -> dict:
    linked_ids = {str(link.event_id) for link in (session.event_links or [])}
    if session.event_id is not None:
        linked_ids.add(str(session.event_id))
    return {
        "id": str(session.id),
        "title": session.title,
        "eventId": str(session.event_id) if session.event_id else None,
        "eventIds": sorted(linked_ids),
        "status": session.status,
        "durationMs": session.duration_ms,
        "audioContentType": session.audio_content_type,
        "audioSizeBytes": session.audio_size_bytes,
        "hasAudio": bool(session.audio_storage_key),
        "hasTranscript": session.transcript is not None,
        "hasNote": session.note is not None,
        "errorMessage": session.error_message,
        "startedAt": session.started_at.isoformat() if session.started_at else None,
        "endedAt": session.ended_at.isoformat() if session.ended_at else None,
        "createdAt": session.created_at.isoformat() if session.created_at else None,
        "createdBy": str(session.created_by),
        "noteTitle": session.note.title if session.note else None,
    }


def transcript_to_dict(transcript: MeetingTranscript) -> dict:
    try:
        segments = json.loads(transcript.segments_json or "[]")
    except json.JSONDecodeError:
        segments = []
    return {
        "fullText": transcript.full_text,
        "segments": segments,
        "language": transcript.language,
        "provider": transcript.provider,
        "createdAt": transcript.created_at.isoformat() if transcript.created_at else None,
    }


def note_to_dict(note: MeetingNote) -> dict:
    try:
        sections = json.loads(note.sections_json or "[]")
    except json.JSONDecodeError:
        sections = []
    return {
        "title": note.title,
        "summary": note.summary,
        "sections": sections,
        "createdAt": note.created_at.isoformat() if note.created_at else None,
        "updatedAt": note.updated_at.isoformat() if note.updated_at else None,
    }
