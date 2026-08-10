"""Messenger Agenda application service."""

from __future__ import annotations

import json
import uuid
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import permission_keys as pk
from app.core.config import settings
from app.models.messenger_agenda import MessengerAgendaSession, MessengerConnection
from app.models.profile import Profile
from app.services import authorization as authz
from app.services.messenger_agenda.agenda import (
    AgendaBullet,
    agenda_to_dict,
    bullets_from_payload,
    generate_agenda,
)
from app.services.messenger_agenda.assignments import (
    drafts_to_dicts,
    generate_assignment_drafts,
)
from app.services.messenger_agenda.contributors import (
    collect_contributors,
    contributors_to_dicts,
    parse_utterances,
)
from app.services.messenger_agenda.keywords import (
    DEFAULT_END_KEYWORD,
    DEFAULT_START_KEYWORD,
    extract_capture_window,
)

# Demo threads shown after a camper grants Messenger access in local/dev.
_DEMO_THREADS = [
    {"id": "thread-asb-cabinet", "label": "ASB Cabinet", "granted": True},
    {"id": "thread-events-crew", "label": "Events Crew", "granted": True},
    {"id": "thread-l2-group", "label": "L2 Group Chat", "granted": True},
]


def _now() -> datetime:
    return datetime.now(UTC)


def _can_manage(db: Session, profile: Profile) -> bool:
    return authz.has_permission(db, profile, pk.MESSENGER_AGENDA_MANAGE)


def _require_session_access(
    db: Session, profile: Profile, session: MessengerAgendaSession
) -> None:
    if session.created_by == profile.id:
        return
    if _can_manage(db, profile):
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail={
            "code": "permission_denied",
            "message": "You do not have permission to access this Messenger agenda session.",
        },
    )


def _load_session(db: Session, session_id: uuid.UUID) -> MessengerAgendaSession:
    session = db.get(MessengerAgendaSession, session_id)
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Messenger agenda session not found.",
        )
    return session


def session_to_dict(session: MessengerAgendaSession) -> dict:
    try:
        agenda = json.loads(session.agenda_json or "{}")
    except json.JSONDecodeError:
        agenda = {}
    try:
        assignments = json.loads(session.assignments_json or "[]")
    except json.JSONDecodeError:
        assignments = []
    try:
        contributors = json.loads(session.contributors_json or "[]")
    except json.JSONDecodeError:
        contributors = []
    transcript = [
        {"text": u.text, "speaker": u.speaker}
        for u in parse_utterances(session.captured_text or "")
    ]
    return {
        "id": str(session.id),
        "title": session.title,
        "status": session.status,
        "source": session.source,
        "threadId": session.thread_id,
        "threadLabel": session.thread_label,
        "startKeyword": session.start_keyword,
        "endKeyword": session.end_keyword,
        "rawText": session.raw_text,
        "capturedText": session.captured_text,
        "agenda": agenda,
        "assignments": assignments,
        "contributors": contributors,
        "transcript": transcript,
        "planId": session.plan_id,
        "capturingStartedAt": (
            session.capturing_started_at.isoformat()
            if session.capturing_started_at
            else None
        ),
        "finalizedAt": (
            session.finalized_at.isoformat() if session.finalized_at else None
        ),
        "createdAt": session.created_at.isoformat() if session.created_at else None,
        "updatedAt": session.updated_at.isoformat() if session.updated_at else None,
    }


def list_sessions(db: Session, profile: Profile) -> list[MessengerAgendaSession]:
    authz.require_permission(db, profile, pk.MESSENGER_AGENDA_VIEW)
    query = select(MessengerAgendaSession).order_by(
        MessengerAgendaSession.created_at.desc()
    )
    if not _can_manage(db, profile):
        query = query.where(MessengerAgendaSession.created_by == profile.id)
    return list(db.scalars(query).all())


def create_session(
    db: Session,
    profile: Profile,
    *,
    title: str | None = None,
    source: str = "paste",
    thread_id: str | None = None,
    thread_label: str | None = None,
    start_keyword: str | None = None,
    end_keyword: str | None = None,
) -> MessengerAgendaSession:
    authz.require_permission(db, profile, pk.MESSENGER_AGENDA_INGEST)
    session = MessengerAgendaSession(
        created_by=profile.id,
        title=(title or "Messenger agenda").strip()[:200] or "Messenger agenda",
        status="idle",
        source=source if source in {"paste", "messenger"} else "paste",
        thread_id=thread_id,
        thread_label=thread_label,
        start_keyword=(start_keyword or DEFAULT_START_KEYWORD).strip().lower()
        or DEFAULT_START_KEYWORD,
        end_keyword=(end_keyword or DEFAULT_END_KEYWORD).strip().lower()
        or DEFAULT_END_KEYWORD,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def get_session(
    db: Session, profile: Profile, session_id: uuid.UUID
) -> MessengerAgendaSession:
    authz.require_permission(db, profile, pk.MESSENGER_AGENDA_VIEW)
    session = _load_session(db, session_id)
    _require_session_access(db, profile, session)
    return session


def start_capture(
    db: Session, profile: Profile, session_id: uuid.UUID
) -> MessengerAgendaSession:
    """Button press: open the capture window (server clock)."""
    authz.require_permission(db, profile, pk.MESSENGER_AGENDA_INGEST)
    session = _load_session(db, session_id)
    _require_session_access(db, profile, session)
    if session.status == "finalized":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This session is already finalized.",
        )
    session.status = "capturing"
    session.capturing_started_at = _now()
    session.updated_at = _now()
    db.commit()
    db.refresh(session)
    return session


def ingest_text(
    db: Session,
    profile: Profile,
    session_id: uuid.UUID,
    *,
    raw_text: str,
    append: bool = False,
) -> MessengerAgendaSession:
    """Ingest Messenger/paste text. Auto-finalizes when the end keyword appears."""
    authz.require_permission(db, profile, pk.MESSENGER_AGENDA_INGEST)
    session = _load_session(db, session_id)
    _require_session_access(db, profile, session)
    if session.status == "finalized":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This session is already finalized.",
        )

    combined = (
        f"{session.raw_text}\n{raw_text}".strip() if append else raw_text
    )
    session.raw_text = combined
    capturing = session.status == "capturing"
    captured, saw_start, saw_end = extract_capture_window(
        combined,
        start_keyword=session.start_keyword,
        end_keyword=session.end_keyword,
        capturing=capturing,
    )
    if saw_start and session.status == "idle":
        session.status = "capturing"
        session.capturing_started_at = session.capturing_started_at or _now()
    session.captured_text = captured
    # Refresh the color legend while capturing so the UI can show who is in.
    session.contributors_json = json.dumps(
        contributors_to_dicts(collect_contributors(parse_utterances(captured)))
    )
    session.updated_at = _now()

    if saw_end and (capturing or saw_start):
        return _finalize_locked(db, session)

    db.commit()
    db.refresh(session)
    return session


def finalize(
    db: Session, profile: Profile, session_id: uuid.UUID
) -> MessengerAgendaSession:
    authz.require_permission(db, profile, pk.MESSENGER_AGENDA_INGEST)
    session = _load_session(db, session_id)
    _require_session_access(db, profile, session)
    return _finalize_locked(db, session)


def _finalize_locked(
    db: Session, session: MessengerAgendaSession
) -> MessengerAgendaSession:
    if not session.captured_text.strip() and session.raw_text.strip():
        captured, _, _ = extract_capture_window(
            session.raw_text,
            start_keyword=session.start_keyword,
            end_keyword=session.end_keyword,
            capturing=True,
        )
        session.captured_text = captured or session.raw_text.strip()

    agenda = generate_agenda(
        session_title=session.title,
        captured_text=session.captured_text,
        start_keyword=session.start_keyword,
        end_keyword=session.end_keyword,
    )
    session.agenda_json = json.dumps(agenda_to_dict(agenda))
    session.contributors_json = json.dumps(contributors_to_dicts(agenda.contributors))
    # Seed assignments from action items so Auto-gen has a baseline.
    action_section = next(
        (s for s in agenda.sections if s.title == "Action items"), None
    )
    drafts = generate_assignment_drafts(action_section.bullets if action_section else ())
    session.assignments_json = json.dumps(drafts_to_dicts(drafts))
    session.status = "finalized"
    session.finalized_at = _now()
    session.updated_at = _now()
    db.commit()
    db.refresh(session)
    return session


def generate_assignments(
    db: Session, profile: Profile, session_id: uuid.UUID
) -> MessengerAgendaSession:
    """Re-run assignment auto-generation from the finalized agenda."""
    authz.require_permission(db, profile, pk.MESSENGER_AGENDA_INGEST)
    session = _load_session(db, session_id)
    _require_session_access(db, profile, session)
    if session.status != "finalized":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Finalize the agenda before generating assignments.",
        )
    try:
        agenda = json.loads(session.agenda_json or "{}")
    except json.JSONDecodeError:
        agenda = {}
    action_bullets: list[AgendaBullet] = []
    for section in agenda.get("sections") or []:
        if section.get("title") == "Action items":
            action_bullets = bullets_from_payload(section.get("bullets"))
            break
    if not action_bullets and session.captured_text:
        action_bullets = [
            AgendaBullet(text=u.text, speaker=u.speaker)
            for u in parse_utterances(session.captured_text)
        ][:10]
    drafts = generate_assignment_drafts(action_bullets)
    session.assignments_json = json.dumps(drafts_to_dicts(drafts))
    session.updated_at = _now()
    db.commit()
    db.refresh(session)
    return session


def attach_plan_id(
    db: Session,
    profile: Profile,
    session_id: uuid.UUID,
    *,
    plan_id: str,
) -> MessengerAgendaSession:
    authz.require_permission(db, profile, pk.MESSENGER_AGENDA_INGEST)
    session = _load_session(db, session_id)
    _require_session_access(db, profile, session)
    session.plan_id = plan_id[:80]
    session.updated_at = _now()
    db.commit()
    db.refresh(session)
    return session


def get_connection(db: Session, profile: Profile) -> dict:
    authz.require_permission(db, profile, pk.MESSENGER_AGENDA_VIEW)
    row = db.scalar(
        select(MessengerConnection).where(MessengerConnection.profile_id == profile.id)
    )
    meta_configured = bool(
        getattr(settings, "meta_app_id", "")
        and getattr(settings, "meta_app_secret", "")
    )
    if row is None:
        return {
            "status": "disconnected",
            "grantedThreads": [],
            "metaConfigured": meta_configured,
            "connectedAt": None,
        }
    try:
        threads = json.loads(row.granted_threads_json or "[]")
    except json.JSONDecodeError:
        threads = []
    return {
        "status": row.status,
        "grantedThreads": threads,
        "metaConfigured": meta_configured,
        "connectedAt": row.connected_at.isoformat() if row.connected_at else None,
    }


def connect_messenger(
    db: Session,
    profile: Profile,
    *,
    granted_thread_ids: list[str] | None = None,
) -> dict:
    """Grant L2 Hub access to selected Messenger chats.

    When Meta Graph credentials are not configured, this records a local demo
    grant so the Tools UI can be exercised end-to-end without a paid API.
    """
    authz.require_permission(db, profile, pk.MESSENGER_AGENDA_INGEST)
    row = db.scalar(
        select(MessengerConnection).where(MessengerConnection.profile_id == profile.id)
    )
    if row is None:
        row = MessengerConnection(profile_id=profile.id)
        db.add(row)

    if granted_thread_ids:
        selected = {
            tid for tid in granted_thread_ids if isinstance(tid, str) and tid.strip()
        }
        threads = [t for t in _DEMO_THREADS if t["id"] in selected] or list(
            _DEMO_THREADS
        )
    else:
        threads = list(_DEMO_THREADS)

    row.status = "connected"
    row.granted_threads_json = json.dumps(threads)
    row.connected_at = _now()
    row.updated_at = _now()
    db.commit()
    return get_connection(db, profile)


def disconnect_messenger(db: Session, profile: Profile) -> dict:
    authz.require_permission(db, profile, pk.MESSENGER_AGENDA_INGEST)
    row = db.scalar(
        select(MessengerConnection).where(MessengerConnection.profile_id == profile.id)
    )
    if row is not None:
        row.status = "disconnected"
        row.granted_threads_json = "[]"
        row.access_token_enc = None
        row.connected_at = None
        row.updated_at = _now()
        db.commit()
    return get_connection(db, profile)
