"""Public photographer drop — no login required."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, File, Form, UploadFile

from app.api.deps import DbSession, Storage
from app.models.photographer import PHOTO_PERMISSIONS
from app.services import photographer as photo_service

router = APIRouter(prefix="/public/photographer", tags=["photographer"])


@router.get("/events")
def list_public_events(db: DbSession) -> dict:
    """Event picker for the public photo drop form."""
    return {"events": photo_service.public_event_options(db)}


@router.get("/options")
def photographer_options() -> dict:
    """Static labels for the permission dropdown."""
    return {
        "permissions": [
            {"value": "instagram", "label": "Instagram (ASB / school accounts)"},
            {"value": "yearbook", "label": "Yearbook"},
            {
                "value": "instagram_and_yearbook",
                "label": "Instagram and Yearbook",
            },
            {"value": "other", "label": "Other Leadership use"},
        ],
        "allowedPermissions": list(PHOTO_PERMISSIONS),
    }


@router.post("/submissions", status_code=201)
async def create_photographer_submission(
    db: DbSession,
    storage: Storage,
    eventId: Annotated[uuid.UUID, Form()],
    creditName: Annotated[str, Form()],
    socialMediaUrl: Annotated[str, Form()],
    permission: Annotated[str, Form()],
    photographerName: Annotated[str, Form()] = "",
    driveUrl: Annotated[str, Form()] = "",
    notes: Annotated[str, Form()] = "",
    file: Annotated[UploadFile | None, File()] = None,
) -> dict:
    """Accept a Drive link and/or photo file for one event."""
    row = await photo_service.create_submission(
        db,
        storage,
        event_id=eventId,
        credit_name=creditName,
        social_media_url=socialMediaUrl,
        permission=permission,
        photographer_name=photographerName,
        drive_url=driveUrl or None,
        notes=notes,
        upload=file,
    )
    return {"submission": photo_service.submission_receipt(row)}
