"""Privileged-action audit logging. Never store feedback bodies or secrets."""

from __future__ import annotations

import json
import uuid
from typing import Any

from sqlalchemy.orm import Session

from app.models import AuditLog

_SENSITIVE_METADATA_KEYS = frozenset(
    {
        "password",
        "token",
        "access_token",
        "refresh_token",
        "feedback_body",
        "anonymous_concern",
        "author_id",
        "author_email",
    }
)


def _scrub(metadata: dict[str, Any] | None) -> str | None:
    if not metadata:
        return None
    cleaned = {
        key: value
        for key, value in metadata.items()
        if key not in _SENSITIVE_METADATA_KEYS
    }
    return json.dumps(cleaned, default=str)


def write_audit_log(
    db: Session,
    *,
    actor_user_id: uuid.UUID | None,
    action: str,
    target_type: str,
    target_id: str | uuid.UUID | None = None,
    metadata: dict[str, Any] | None = None,
) -> AuditLog:
    entry = AuditLog(
        actor_user_id=actor_user_id,
        action=action,
        target_type=target_type,
        target_id=str(target_id) if target_id is not None else None,
        metadata_json=_scrub(metadata),
    )
    db.add(entry)
    db.flush()
    return entry
