"""Object storage: local folder backend + FastAPI dependency injection."""

from __future__ import annotations

import json
from pathlib import Path

import httpx
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
from app.storage.supabase import SupabaseStorage, SupabaseStorageError


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
            assert Path(tmp_path / body["key"]).read_text(encoding="utf-8") == ("hello from di")
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


# ---------------------------------------------------------------------------
# Supabase Storage backend
# ---------------------------------------------------------------------------
#
# These drive a real httpx.Client through a MockTransport, so request paths,
# headers, and response handling are exercised end to end at the HTTP layer.
# What they do not prove is that the live project answers the way the fixture
# does — the bucket has to exist and the secret key has to be set for that, and
# neither is true in CI. Treat these as contract tests against the documented
# Storage API, not as verification against the real project.


def _supabase_storage(handler) -> SupabaseStorage:
    return SupabaseStorage(
        project_url="https://example.supabase.co",
        service_key="secret-key",
        bucket="attachments",
        transport=httpx.MockTransport(handler),
    )


def test_supabase_put_upserts_and_authenticates() -> None:
    seen: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["method"] = request.method
        seen["upsert"] = request.headers.get("x-upsert")
        seen["auth"] = request.headers.get("authorization")
        seen["apikey"] = request.headers.get("apikey")
        seen["content_type"] = request.headers.get("content-type")
        seen["body"] = request.content
        return httpx.Response(200, json={"Key": "attachments/note-taker/abc.webm"})

    storage = _supabase_storage(handler)
    stored = storage.put("note-taker/abc.webm", b"audio", content_type="audio/webm")

    assert seen["method"] == "POST"
    assert seen["url"] == (
        "https://example.supabase.co/storage/v1/object/attachments/note-taker/abc.webm"
    )
    # POST without upsert is create-only and would 409 on a repeat write, which
    # the protocol forbids: put() promises overwrite.
    assert seen["upsert"] == "true"
    assert seen["auth"] == "Bearer secret-key"
    assert seen["apikey"] == "secret-key"
    assert seen["content_type"] == "audio/webm"
    assert seen["body"] == b"audio"
    assert stored.key == "note-taker/abc.webm"
    assert stored.size_bytes == 5


def test_supabase_get_round_trip_and_missing_key() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("present.txt"):
            return httpx.Response(200, content=b"hello")
        return httpx.Response(404, json={"error": "not_found"})

    storage = _supabase_storage(handler)

    assert storage.get("smoke/present.txt") == b"hello"
    # Callers already handle FileNotFoundError from the local backend; the
    # Supabase backend has to raise the same thing rather than an HTTP error.
    with pytest.raises(FileNotFoundError):
        storage.get("smoke/absent.txt")


def test_supabase_delete_treats_missing_key_as_no_op() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(404, json={"error": "not_found"})

    _supabase_storage(handler).delete("smoke/gone.txt")


def test_supabase_exists_reads_object_info() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert "/object/info/attachments/" in request.url.path
        found = request.url.path.endswith("here.txt")
        return httpx.Response(200 if found else 404, json={})

    storage = _supabase_storage(handler)
    assert storage.exists("smoke/here.txt")
    assert not storage.exists("smoke/nope.txt")


def test_supabase_url_for_returns_absolute_signed_url() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.method == "POST"
        assert "/object/sign/attachments/" in request.url.path
        assert json.loads(request.content)["expiresIn"] == 3600
        # The API answers with a path relative to /storage/v1.
        return httpx.Response(
            200,
            json={"signedURL": "/object/sign/attachments/smoke/a.txt?token=jwt"},
        )

    url = _supabase_storage(handler).url_for("smoke/a.txt")
    assert url == (
        "https://example.supabase.co/storage/v1/object/sign/attachments/smoke/a.txt?token=jwt"
    )


def test_supabase_surfaces_upload_failures() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(413, text="Payload too large")

    with pytest.raises(SupabaseStorageError, match="413"):
        _supabase_storage(handler).put("smoke/big.bin", b"x")


def test_supabase_rejects_path_traversal() -> None:
    def handler(request: httpx.Request) -> httpx.Response:  # pragma: no cover
        raise AssertionError("request should never be sent")

    storage = _supabase_storage(handler)
    for bad in ("../secrets.txt", "/leading-slash.txt", "a/../../b.txt", ""):
        with pytest.raises(ValueError):
            storage.put(bad, b"x")


def test_factory_builds_supabase_storage() -> None:
    storage = build_storage(
        Settings(
            storage_backend="supabase",
            supabase_url="https://example.supabase.co",
            supabase_service_key="secret-key",
            supabase_storage_bucket="attachments",
        )
    )
    assert isinstance(storage, SupabaseStorage)
    assert storage.bucket == "attachments"


def test_factory_refuses_supabase_storage_without_credentials() -> None:
    # Failing at startup beats failing after a meeting nobody can re-record.
    with pytest.raises(UnsupportedStorageBackend, match="SUPABASE_SERVICE_KEY"):
        build_storage(
            Settings(
                storage_backend="supabase",
                supabase_url="https://example.supabase.co",
                supabase_service_key="",
            )
        )
