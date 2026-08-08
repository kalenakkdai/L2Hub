"""Object storage: local folder backend + FastAPI dependency injection."""

from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import app as fastapi_app
from app.storage.factory import (
    UnsupportedStorageBackend,
    build_storage,
    reset_storage_singleton,
)
from app.storage.local import LocalFolderStorage
from app.storage.protocol import opaque_storage_key


@pytest.fixture(autouse=True)
def _reset_storage() -> None:
    reset_storage_singleton()
    yield
    reset_storage_singleton()


def test_local_folder_put_get_delete_round_trip(tmp_path: Path) -> None:
    storage = LocalFolderStorage(tmp_path)
    key = opaque_storage_key(namespace="reports", extension="png")

    stored = storage.put(key, b"\x89PNG", content_type="image/png")

    assert stored.key == key
    assert stored.size_bytes == 4
    assert stored.content_type == "image/png"
    assert storage.exists(key)
    assert storage.get(key) == b"\x89PNG"
    assert Path(tmp_path / key).is_file()
    assert stored.url.startswith("file://")

    storage.delete(key)
    assert not storage.exists(key)
    with pytest.raises(FileNotFoundError):
        storage.get(key)


def test_opaque_keys_never_include_user_filenames() -> None:
    key = opaque_storage_key(namespace="reports", extension="png")
    assert "kalena" not in key
    assert "iphone" not in key
    assert key.startswith("reports/")
    assert key.endswith(".png")
    assert ".." not in key


def test_local_storage_rejects_path_traversal(tmp_path: Path) -> None:
    storage = LocalFolderStorage(tmp_path)
    with pytest.raises(ValueError):
        storage.put("../escape.txt", b"nope")
    with pytest.raises(ValueError):
        storage.put("/absolute.txt", b"nope")


def test_factory_builds_local_storage(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("STORAGE_BACKEND", "local")
    monkeypatch.setenv("STORAGE_LOCAL_ROOT", str(tmp_path))
    # Rebuild settings from env for this process would require a new Settings();
    # pass an explicit Settings instance instead.
    config = Settings(
        storage_backend="local",
        storage_local_root=str(tmp_path),
    )
    storage = build_storage(config)
    assert isinstance(storage, LocalFolderStorage)
    assert storage.root == tmp_path.resolve()


def test_factory_rejects_cloud_backends_until_wired() -> None:
    for backend in ("s3", "gcs", "aws", "google"):
        with pytest.raises(UnsupportedStorageBackend):
            build_storage(Settings(storage_backend=backend))


def test_fastapi_injects_storage_and_smoke_writes_to_folder(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.api import deps
    from app.core import config as config_module

    monkeypatch.setattr(config_module.settings, "environment", "development")
    monkeypatch.setattr(config_module.settings, "storage_backend", "local")
    monkeypatch.setattr(config_module.settings, "storage_local_root", str(tmp_path))
    reset_storage_singleton()

    storage = LocalFolderStorage(tmp_path)
    fastapi_app.dependency_overrides[deps.get_storage] = lambda: storage
    try:
        with TestClient(fastapi_app) as client:
            status = client.get("/storage/status")
            assert status.status_code == 200
            assert status.json()["implementation"] == "LocalFolderStorage"
            assert status.json()["localRoot"] == str(tmp_path.resolve())

            smoke = client.post(
                "/storage/smoke",
                json={"text": "hello from di", "namespace": "smoke"},
            )
            assert smoke.status_code == 200
            body = smoke.json()
            assert body["roundTripMatches"] is True
            assert body["exists"] is True
            assert Path(tmp_path / body["key"]).read_text(encoding="utf-8") == (
                "hello from di"
            )
    finally:
        fastapi_app.dependency_overrides.pop(deps.get_storage, None)


def test_smoke_endpoint_hidden_outside_development(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.api import deps
    from app.core import config as config_module

    monkeypatch.setattr(config_module.settings, "environment", "production")
    storage = LocalFolderStorage(tmp_path)
    fastapi_app.dependency_overrides[deps.get_storage] = lambda: storage
    try:
        with TestClient(fastapi_app) as client:
            response = client.post("/storage/smoke", json={"text": "nope"})
            assert response.status_code == 404
    finally:
        fastapi_app.dependency_overrides.pop(deps.get_storage, None)


def test_writes_into_repo_local_storage_folder() -> None:
    """Prove the default root is a real folder on this computer."""
    from app.storage.factory import default_local_root

    root = default_local_root()
    storage = LocalFolderStorage(root)
    key = opaque_storage_key(namespace="smoke", extension="txt")
    storage.put(key, b"l2hub local storage ok\n", content_type="text/plain")

    written = root / key
    assert written.is_file()
    assert written.read_bytes() == b"l2hub local storage ok\n"
    # Leave the file so it is visible under backend/.local-storage/smoke/
