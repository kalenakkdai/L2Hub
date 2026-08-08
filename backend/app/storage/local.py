"""Local-folder ObjectStorage for development and temporary testing."""

from __future__ import annotations

from pathlib import Path

from app.storage.protocol import StoredObject


class LocalFolderStorage:
    """Store blobs as files under a root directory on this machine.

    Layout: ``{root}/{key}``. Keys may include ``/`` segments (namespaces).
    Path traversal outside the root is rejected.
    """

    backend_name = "local"

    def __init__(self, root: Path | str) -> None:
        self.root = Path(root).expanduser().resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def put(
        self,
        key: str,
        data: bytes,
        *,
        content_type: str | None = None,
    ) -> StoredObject:
        path = self._resolve(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return StoredObject(
            key=key,
            size_bytes=len(data),
            content_type=content_type,
            url=path.as_uri(),
        )

    def get(self, key: str) -> bytes:
        path = self._resolve(key)
        if not path.is_file():
            raise FileNotFoundError(f"No object at key {key!r}")
        return path.read_bytes()

    def delete(self, key: str) -> None:
        path = self._resolve(key)
        if path.is_file():
            path.unlink()

    def exists(self, key: str) -> bool:
        return self._resolve(key).is_file()

    def url_for(self, key: str) -> str:
        return self._resolve(key).as_uri()

    def _resolve(self, key: str) -> Path:
        if not key or key.startswith("/") or ".." in Path(key).parts:
            raise ValueError(f"Invalid storage key: {key!r}")
        path = (self.root / key).resolve()
        if not path.is_relative_to(self.root):
            raise ValueError(f"Storage key escapes root: {key!r}")
        return path
