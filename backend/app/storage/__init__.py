"""Object storage with dependency injection.

Swap backends via `STORAGE_BACKEND` without changing call sites:

- `local` — files under a folder on this machine (development only)
- `supabase` — objects in a private Supabase Storage bucket (durable)
- `s3` / `gcs` — reserved for a later cloud bucket implementation
"""

from app.storage.factory import build_storage, reset_storage_singleton
from app.storage.local import LocalFolderStorage
from app.storage.protocol import ObjectStorage, StoredObject, opaque_storage_key
from app.storage.supabase import SupabaseStorage, SupabaseStorageError

__all__ = [
    "LocalFolderStorage",
    "ObjectStorage",
    "StoredObject",
    "SupabaseStorage",
    "SupabaseStorageError",
    "build_storage",
    "opaque_storage_key",
    "reset_storage_singleton",
]
