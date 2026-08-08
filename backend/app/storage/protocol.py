"""Storage contract shared by local-folder and future cloud backends."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True, slots=True)
class StoredObject:
    """Metadata returned after a successful put.

    `key` is opaque and safe to store in the database. Never put an original
    user filename in the key — that can identify anonymous report authors.
    """

    key: str
    size_bytes: int
    content_type: str | None
    # Backend-specific locator (file:// path today; https signed URL later).
    url: str


class ObjectStorage(Protocol):
    """Byte-blob store. Call sites depend on this protocol, not a folder path."""

    def put(
        self,
        key: str,
        data: bytes,
        *,
        content_type: str | None = None,
    ) -> StoredObject:
        """Write `data` at `key`, overwriting if it already exists."""

    def get(self, key: str) -> bytes:
        """Return the bytes for `key`, or raise FileNotFoundError."""

    def delete(self, key: str) -> None:
        """Remove `key` if present. Missing keys are a no-op."""

    def exists(self, key: str) -> bool:
        """True when `key` is present in the store."""

    def url_for(self, key: str) -> str:
        """Locator for `key` without reading the bytes."""


def opaque_storage_key(*, namespace: str, extension: str | None = None) -> str:
    """Build a privacy-preserving key that never includes a user filename.

    Example: ``reports/a1b2c3d4e5f6.png``
    """
    stem = uuid.uuid4().hex
    clean_ns = namespace.strip("/").replace("..", "")
    if not clean_ns:
        raise ValueError("storage namespace must not be empty")
    if extension:
        ext = extension.lstrip(".").lower()
        return f"{clean_ns}/{stem}.{ext}"
    return f"{clean_ns}/{stem}"
