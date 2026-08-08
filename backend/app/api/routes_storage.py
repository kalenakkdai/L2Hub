"""Development-only smoke endpoints for the injectable object store."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.api.deps import Storage
from app.core.config import settings
from app.storage.local import LocalFolderStorage
from app.storage.protocol import opaque_storage_key

router = APIRouter(prefix="/storage", tags=["storage"])


class SmokeWriteBody(BaseModel):
    """Tiny payload so we can confirm a round-trip without multipart yet."""

    text: str = Field(min_length=1, max_length=4_096)
    namespace: str = Field(default="smoke", min_length=1, max_length=64)


@router.get("/status")
def storage_status(storage: Storage) -> dict:
    """Report which storage backend is wired in (no secrets)."""
    root = None
    if isinstance(storage, LocalFolderStorage):
        root = str(storage.root)
    return {
        "backend": settings.storage_backend,
        "implementation": type(storage).__name__,
        "localRoot": root,
    }


@router.post("/smoke")
def storage_smoke_write(body: SmokeWriteBody, storage: Storage) -> dict:
    """Write a small text blob and read it back.

    Available only in development so we can verify DI against a real folder
    without opening a general-purpose upload API yet.
    """
    if settings.environment != "development":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Storage smoke endpoint is development-only.",
        )

    key = opaque_storage_key(namespace=body.namespace, extension="txt")
    stored = storage.put(
        key,
        body.text.encode("utf-8"),
        content_type="text/plain; charset=utf-8",
    )
    round_trip = storage.get(key).decode("utf-8")
    return {
        "key": stored.key,
        "sizeBytes": stored.size_bytes,
        "url": stored.url,
        "roundTripMatches": round_trip == body.text,
        "exists": storage.exists(key),
    }
