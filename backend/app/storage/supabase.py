"""Supabase Storage implementation of the ObjectStorage protocol.

Durable replacement for LocalFolderStorage. The container filesystem is wiped
on every deploy and is not shared between tasks, so anything written through
the local backend in production is lost the first time the service restarts or
scales past one instance — meeting recordings included.

This talks to the Storage REST API with the project's secret key, which
bypasses RLS. That is the right call for a server-side backend: authorization
for these objects is decided by `require_permission` on the routes above, not
by storage policies. The bucket is private, so nothing here is reachable
without either this key or a signed URL.
"""

from __future__ import annotations

from urllib.parse import quote

import httpx

from app.storage.protocol import StoredObject

# Uploads are meeting recordings, not thumbnails, so the default 5s timeout is
# far too tight. Connect stays short; read/write get room for a long audio blob.
_TIMEOUT = httpx.Timeout(connect=10.0, read=120.0, write=120.0, pool=10.0)


class SupabaseStorageError(RuntimeError):
    """Storage API returned something other than success."""


class SupabaseStorage:
    """Store blobs as objects in a private Supabase Storage bucket.

    Layout: ``{bucket}/{key}``. Keys may include ``/`` segments (namespaces),
    which become folders in the Storage browser.

    One wrinkle worth knowing: unlike LocalFolderStorage, `put().url` and
    `url_for()` do not return the same string. `put` returns the canonical
    object path, which is stable but requires credentials to fetch; `url_for`
    mints a short-lived signed URL that does not. Signing costs a round trip,
    and no call site persists `StoredObject.url`, so paying for it on every
    upload would buy nothing.
    """

    backend_name = "supabase"

    def __init__(
        self,
        *,
        project_url: str,
        service_key: str,
        bucket: str,
        signed_url_ttl_seconds: int = 3600,
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        if not project_url:
            raise ValueError("Supabase storage needs SUPABASE_URL")
        if not service_key:
            raise ValueError("Supabase storage needs SUPABASE_SERVICE_KEY")
        if not bucket:
            raise ValueError("Supabase storage needs SUPABASE_STORAGE_BUCKET")

        self.bucket = bucket
        self.signed_url_ttl_seconds = signed_url_ttl_seconds
        self._base = f"{project_url.rstrip('/')}/storage/v1"
        # The client is held for the life of the process (storage is a
        # singleton), so connections are pooled across requests rather than
        # renegotiating TLS for every upload.
        self._client = httpx.Client(
            timeout=_TIMEOUT,
            # Tests inject a MockTransport here so the request construction —
            # paths, upsert header, signed-URL assembly — is exercised for
            # real rather than stubbed out at the method boundary.
            transport=transport,
            headers={
                "Authorization": f"Bearer {service_key}",
                # Storage checks apikey as well as the bearer token.
                "apikey": service_key,
            },
        )

    def put(
        self,
        key: str,
        data: bytes,
        *,
        content_type: str | None = None,
    ) -> StoredObject:
        path = self._object_path(key)
        response = self._client.post(
            f"{self._base}/object/{path}",
            content=data,
            headers={
                "Content-Type": content_type or "application/octet-stream",
                # POST alone is create-only and 409s on an existing key. The
                # protocol promises overwrite, so upsert is not optional.
                "x-upsert": "true",
            },
        )
        if response.status_code >= 400:
            raise SupabaseStorageError(
                f"Upload to {self.bucket}/{key} failed "
                f"({response.status_code}): {response.text[:300]}"
            )
        return StoredObject(
            key=key,
            size_bytes=len(data),
            content_type=content_type,
            url=f"{self._base}/object/{path}",
        )

    def get(self, key: str) -> bytes:
        response = self._client.get(f"{self._base}/object/{self._object_path(key)}")
        if response.status_code == 404:
            raise FileNotFoundError(f"No object at key {key!r}")
        if response.status_code >= 400:
            raise SupabaseStorageError(
                f"Download of {self.bucket}/{key} failed "
                f"({response.status_code}): {response.text[:300]}"
            )
        return response.content

    def delete(self, key: str) -> None:
        response = self._client.delete(f"{self._base}/object/{self._object_path(key)}")
        # Missing keys are a no-op per the protocol, and Storage answers a
        # delete for an absent object with 404 rather than success.
        if response.status_code == 404:
            return
        if response.status_code >= 400:
            raise SupabaseStorageError(
                f"Delete of {self.bucket}/{key} failed "
                f"({response.status_code}): {response.text[:300]}"
            )

    def exists(self, key: str) -> bool:
        response = self._client.get(f"{self._base}/object/info/{self._object_path(key)}")
        return response.status_code == 200

    def url_for(self, key: str) -> str:
        """Short-lived signed URL, so the bucket can stay private."""
        path = self._object_path(key)
        response = self._client.post(
            f"{self._base}/object/sign/{path}",
            json={"expiresIn": self.signed_url_ttl_seconds},
        )
        if response.status_code == 404:
            raise FileNotFoundError(f"No object at key {key!r}")
        if response.status_code >= 400:
            raise SupabaseStorageError(
                f"Signing {self.bucket}/{key} failed "
                f"({response.status_code}): {response.text[:300]}"
            )
        signed = response.json().get("signedURL", "")
        if not signed:
            raise SupabaseStorageError(f"Storage returned no signedURL for {key!r}")
        # The API answers with a path relative to /storage/v1, with or without
        # a leading slash depending on version.
        return f"{self._base}/{signed.lstrip('/')}"

    def _object_path(self, key: str) -> str:
        """Bucket-qualified, URL-encoded object path.

        The same key validation as the local backend, so a key that is legal
        against one implementation is legal against the other. `safe="/"` keeps
        namespace separators as path segments while escaping everything else.
        """
        if not key or key.startswith("/") or ".." in key.split("/"):
            raise ValueError(f"Invalid storage key: {key!r}")
        return f"{self.bucket}/{quote(key, safe='/')}"
