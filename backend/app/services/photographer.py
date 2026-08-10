"""Public photographer dropbox: list events and accept Drive links / files."""

from __future__ import annotations

import uuid
from urllib.parse import urlparse

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.event_summary import Event
from app.models.photographer import PHOTO_PERMISSIONS, PhotographerSubmission
from app.storage.protocol import ObjectStorage, opaque_storage_key

_DRIVE_HOSTS = {"drive.google.com", "docs.google.com", "www.drive.google.com"}
_ALLOWED_UPLOAD_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
    "application/zip",
    "application/pdf",
}
_MAX_UPLOAD_BYTES = 40 * 1024 * 1024  # 40 MB — under the attachments bucket cap


def _clean(value: str | None, *, limit: int) -> str:
    return " ".join((value or "").split())[:limit]


def public_event_options(db: Session) -> list[dict]:
    """Events a photographer can attach work to — no auth, reduced fields."""
    events = db.scalars(
        select(Event)
        .where(Event.status != "calendar")
        .order_by(Event.year.desc(), Event.name)
    ).all()
    return [
        {
            "id": str(event.id),
            "name": event.name,
            "slug": event.slug,
            "year": event.year,
            "status": event.status,
            "startsAt": event.starts_at.isoformat() if event.starts_at else None,
        }
        for event in events
    ]


def _require_http_url(raw: str, *, field: str) -> str:
    text = raw.strip()
    if not text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{field} is required.",
        )
    parsed = urlparse(text)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{field} must be a full http(s) link.",
        )
    return text[:2000]


def _require_drive_url(raw: str) -> str:
    text = _require_http_url(raw, field="Google Drive link")
    host = urlparse(text).hostname or ""
    if host.lower() not in _DRIVE_HOSTS and not host.lower().endswith(".google.com"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Use a Google Drive or Google Docs sharing link.",
        )
    return text


def _extension_for(content_type: str, filename: str | None) -> str | None:
    by_type = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "image/heic": "heic",
        "image/heif": "heif",
        "application/zip": "zip",
        "application/pdf": "pdf",
    }
    if content_type in by_type:
        return by_type[content_type]
    if filename and "." in filename:
        return filename.rsplit(".", 1)[-1].lower()[:8]
    return None


async def create_submission(
    db: Session,
    storage: ObjectStorage,
    *,
    event_id: uuid.UUID,
    credit_name: str,
    social_media_url: str,
    permission: str,
    photographer_name: str = "",
    drive_url: str | None = None,
    notes: str = "",
    upload: UploadFile | None = None,
) -> PhotographerSubmission:
    event = db.get(Event, event_id)
    if event is None or event.status == "calendar":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="That event is not available for photo drops.",
        )

    credit = _clean(credit_name, limit=120)
    if len(credit) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tell us how you want to be credited on Instagram.",
        )

    social = _require_http_url(social_media_url, field="Social media link")
    if permission not in PHOTO_PERMISSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Pick a valid usage permission.",
        )

    cleaned_drive: str | None = None
    if drive_url and drive_url.strip():
        cleaned_drive = _require_drive_url(drive_url)

    storage_key: str | None = None
    content_type: str | None = None
    size_bytes: int | None = None

    if upload is not None and upload.filename:
        data = await upload.read(_MAX_UPLOAD_BYTES + 1)
        if len(data) > _MAX_UPLOAD_BYTES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File is too large (40 MB max).",
            )
        if not data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file was empty.",
            )
        content_type = (upload.content_type or "").split(";")[0].strip().lower()
        if content_type not in _ALLOWED_UPLOAD_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Upload a photo (JPEG/PNG/WebP/HEIC), PDF, or ZIP.",
            )
        ext = _extension_for(content_type, upload.filename)
        storage_key = opaque_storage_key(namespace="photographer", extension=ext)
        stored = storage.put(storage_key, data, content_type=content_type)
        size_bytes = stored.size_bytes

    if not cleaned_drive and not storage_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Add a Google Drive link or upload a file.",
        )

    row = PhotographerSubmission(
        event_id=event.id,
        credit_name=credit,
        social_media_url=social,
        permission=permission,
        drive_url=cleaned_drive,
        storage_key=storage_key,
        content_type=content_type,
        size_bytes=size_bytes,
        notes=_clean(notes, limit=2000),
        photographer_name=_clean(photographer_name, limit=120),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    # Ensure the receipt can name the event without a lazy-load surprise.
    _ = row.event
    return row


def submission_receipt(row: PhotographerSubmission) -> dict:
    """Public confirmation — no storage keys or internal ids beyond the receipt."""
    return {
        "id": str(row.id),
        "eventId": str(row.event_id),
        "eventName": row.event.name if row.event is not None else None,
        "creditName": row.credit_name,
        "permission": row.permission,
        "hasDriveLink": bool(row.drive_url),
        "hasFile": bool(row.storage_key),
        "createdAt": row.created_at.isoformat() if row.created_at else None,
    }