"""Build the configured ObjectStorage implementation."""

from __future__ import annotations

from pathlib import Path

from app.core.config import Settings, settings
from app.storage.local import LocalFolderStorage
from app.storage.protocol import ObjectStorage
from app.storage.supabase import SupabaseStorage

# Default local root: backend/.local-storage (gitignored).
_DEFAULT_LOCAL_ROOT = Path(__file__).resolve().parents[2] / ".local-storage"

_singleton: ObjectStorage | None = None


class UnsupportedStorageBackend(RuntimeError):
    """Raised when STORAGE_BACKEND is set to a backend that is not ready yet."""


def default_local_root() -> Path:
    return _DEFAULT_LOCAL_ROOT


def build_storage(config: Settings | None = None) -> ObjectStorage:
    """Construct a storage backend from settings.

    Call sites should prefer the FastAPI `get_storage` dependency so tests can
    override the implementation. Use this factory directly in scripts/smoke.
    """
    cfg = config or settings
    backend = (cfg.storage_backend or "local").strip().lower()

    if backend == "local":
        root = cfg.storage_local_root.strip() or str(default_local_root())
        return LocalFolderStorage(root)

    if backend in {"supabase", "supabase-storage"}:
        # Checked here rather than at first upload: a missing key should stop
        # the service at startup, not surface as a failed recording after a
        # meeting someone cannot re-record.
        missing = [
            name
            for name, value in (
                ("SUPABASE_URL", cfg.supabase_url),
                ("SUPABASE_SERVICE_KEY", cfg.supabase_service_key),
                ("SUPABASE_STORAGE_BUCKET", cfg.supabase_storage_bucket),
            )
            if not value.strip()
        ]
        if missing:
            raise UnsupportedStorageBackend(
                f"STORAGE_BACKEND={backend!r} needs {', '.join(missing)} set."
            )
        return SupabaseStorage(
            project_url=cfg.supabase_url,
            service_key=cfg.supabase_service_key,
            bucket=cfg.supabase_storage_bucket,
            signed_url_ttl_seconds=cfg.supabase_storage_signed_url_ttl,
        )

    if backend in {"s3", "gcs", "aws", "google"}:
        raise UnsupportedStorageBackend(
            f"STORAGE_BACKEND={backend!r} is reserved for a later cloud bucket. "
            "Use STORAGE_BACKEND=supabase for durable storage today."
        )

    raise UnsupportedStorageBackend(
        f"Unknown STORAGE_BACKEND={backend!r}. Supported today: local, supabase."
    )


def get_storage_singleton() -> ObjectStorage:
    """Process-wide storage instance used by the FastAPI dependency."""
    global _singleton
    if _singleton is None:
        _singleton = build_storage()
    return _singleton


def reset_storage_singleton() -> None:
    """Clear the cached instance so the next call rebuilds from settings."""
    global _singleton
    _singleton = None
