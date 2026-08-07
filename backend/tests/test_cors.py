"""CORS preflight behaviour for the browser client.

`GET /auth/me` sends an `Authorization` header, which makes it a non-simple
request: the browser sends an `OPTIONS` preflight first and refuses to issue
the real call unless that preflight is approved. Starlette answers a preflight
it does not like with `400 Disallowed CORS origin`, so a single missing entry
in the allowlist looks like a bad request rather than a configuration problem.
"""

import pytest
from fastapi.testclient import TestClient

from app.core.config import ENV_FILE, Settings, settings

# What the frontend's apiFetch actually puts on the wire for /auth/me.
PREFLIGHT_HEADERS = {
    "Access-Control-Request-Method": "GET",
    "Access-Control-Request-Headers": "authorization,content-type",
}


@pytest.mark.parametrize("origin", settings.cors_origin_list)
def test_preflight_approves_every_configured_origin(client: TestClient, origin: str) -> None:
    """Each configured origin must survive the preflight the frontend sends.

    Parametrised over the live configuration rather than a fixed list, so a
    developer whose .env lists a different origin still tests their own setup.
    """
    response = client.options("/auth/me", headers={"Origin": origin, **PREFLIGHT_HEADERS})

    assert response.status_code == 200, response.text
    assert response.headers["access-control-allow-origin"] == origin
    assert "GET" in response.headers["access-control-allow-methods"]
    allowed_headers = response.headers["access-control-allow-headers"].lower()
    assert "authorization" in allowed_headers
    assert "content-type" in allowed_headers
    # The frontend does not send cookies, but the header must agree with the
    # middleware's allow_credentials setting or the browser discards the response.
    assert response.headers["access-control-allow-credentials"] == "true"


def test_local_dev_origins_cover_both_loopback_spellings() -> None:
    """localhost and 127.0.0.1 are separate origins to a browser."""
    defaults = Settings(_env_file=None).cors_origin_list

    assert "http://localhost:5173" in defaults
    assert "http://127.0.0.1:5173" in defaults


def test_unlisted_origin_is_still_refused(client: TestClient) -> None:
    """Widening the allowlist must not have turned into allowing everything."""
    response = client.options(
        "/auth/me",
        headers={"Origin": "https://not-our-frontend.example", **PREFLIGHT_HEADERS},
    )

    assert response.status_code == 400
    assert "access-control-allow-origin" not in response.headers


def test_cors_origins_are_split_and_stripped() -> None:
    """The comma-separated string survives spaces and trailing separators."""
    parsed = Settings(
        _env_file=None,
        cors_origins=" http://localhost:5173 , http://127.0.0.1:5173 ,, ",
    ).cors_origin_list

    assert parsed == ["http://localhost:5173", "http://127.0.0.1:5173"]


def test_env_file_is_resolved_independently_of_the_working_directory() -> None:
    """Settings must not depend on where uvicorn or pytest was started."""
    assert ENV_FILE.is_absolute()
    assert ENV_FILE.parent.name == "backend"
    assert ENV_FILE.name == ".env"
