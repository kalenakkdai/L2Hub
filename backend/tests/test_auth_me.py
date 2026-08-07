import uuid
from datetime import timedelta

import pytest
from fastapi.testclient import TestClient

from app.core import security
from app.core.config import settings


def auth_header(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# Happy paths
# ---------------------------------------------------------------------------


def test_returns_profile_for_valid_asymmetric_token(client: TestClient, make_token, make_profile):
    profile = make_profile(email="ada@example.edu", full_name="Ada L", role="officer")
    token = make_token(sub=profile.id)

    response = client.get("/auth/me", headers=auth_header(token))

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == str(profile.id)
    assert body["email"] == "ada@example.edu"
    assert body["full_name"] == "Ada L"
    assert body["role"] == "officer"
    assert body["created_at"]
    # The response must never leak anything beyond the profile schema.
    assert set(body) == {"id", "email", "full_name", "role", "created_at"}


@pytest.mark.parametrize("role", ["student", "committee_head", "officer", "adviser"])
def test_every_role_round_trips_through_the_response_schema(
    client: TestClient, make_token, make_profile, role
):
    profile = make_profile(user_id=uuid.uuid4(), role=role)

    response = client.get("/auth/me", headers=auth_header(make_token(sub=profile.id)))

    assert response.status_code == 200
    assert response.json()["role"] == role


def test_returns_profile_for_legacy_hs256_token(client: TestClient, make_token, make_profile):
    profile = make_profile(role="adviser")
    token = make_token(sub=profile.id, algorithm="HS256")

    response = client.get("/auth/me", headers=auth_header(token))

    assert response.status_code == 200
    assert response.json()["role"] == "adviser"
    assert response.json()["id"] == str(profile.id)


@pytest.mark.parametrize("claimed", ["adviser", "officer", "committee_head"])
def test_role_comes_from_the_database_not_the_token(
    client: TestClient, make_token, make_profile, claimed
):
    """A caller cannot promote themselves by putting a role claim in the JWT."""
    profile = make_profile(role="student")
    token = make_token(
        sub=profile.id,
        user_role=claimed,
        app_metadata={"role": claimed},
        user_metadata={"role": claimed},
    )

    response = client.get("/auth/me", headers=auth_header(token))

    assert response.status_code == 200
    assert response.json()["role"] == "student"


# ---------------------------------------------------------------------------
# Rejected tokens
# ---------------------------------------------------------------------------


def test_missing_authorization_header_is_rejected(client: TestClient):
    response = client.get("/auth/me")

    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"


def test_garbage_token_is_rejected(client: TestClient):
    response = client.get("/auth/me", headers=auth_header("not-a-jwt"))

    assert response.status_code == 401


def test_expired_token_is_rejected(client: TestClient, make_token, make_profile):
    profile = make_profile()
    token = make_token(sub=profile.id, expires_in=timedelta(hours=-1))

    response = client.get("/auth/me", headers=auth_header(token))

    assert response.status_code == 401


def test_token_without_exp_is_rejected(client: TestClient, make_token, make_profile):
    profile = make_profile()
    token = make_token(sub=profile.id, include_exp=False)

    response = client.get("/auth/me", headers=auth_header(token))

    assert response.status_code == 401


def test_token_from_another_project_is_rejected(client: TestClient, make_token, make_profile):
    """Wrong issuer — e.g. a token minted by a different Supabase project."""
    profile = make_profile()
    token = make_token(sub=profile.id, issuer="https://someone-else.supabase.co/auth/v1")

    response = client.get("/auth/me", headers=auth_header(token))

    assert response.status_code == 401


def test_token_with_wrong_audience_is_rejected(client: TestClient, make_token, make_profile):
    profile = make_profile()
    token = make_token(sub=profile.id, audience="anon")

    response = client.get("/auth/me", headers=auth_header(token))

    assert response.status_code == 401


def test_token_signed_by_an_unknown_key_is_rejected(client: TestClient, make_token, make_profile):
    profile = make_profile()
    token = make_token(sub=profile.id, key_id="attacker-key")

    response = client.get("/auth/me", headers=auth_header(token))

    assert response.status_code == 401


def test_unsigned_alg_none_token_is_rejected(client: TestClient, make_profile):
    """The classic JWT downgrade attack must not authenticate anyone."""
    import jwt as pyjwt

    profile = make_profile()
    token = pyjwt.encode(
        {"sub": str(profile.id), "aud": "authenticated", "exp": 9999999999},
        key="",
        algorithm="none",
    )

    response = client.get("/auth/me", headers=auth_header(token))

    assert response.status_code == 401


def test_hs256_token_is_rejected_when_no_shared_secret_is_configured(
    client: TestClient, make_token, make_profile, monkeypatch
):
    profile = make_profile()
    token = make_token(sub=profile.id, algorithm="HS256")
    monkeypatch.setattr(settings, "supabase_jwt_secret", "")

    response = client.get("/auth/me", headers=auth_header(token))

    assert response.status_code == 500
    assert "not configured" in response.json()["detail"]


# ---------------------------------------------------------------------------
# Valid token, missing or malformed profile
# ---------------------------------------------------------------------------


def test_valid_token_without_a_profile_row_returns_404(client: TestClient, make_token):
    token = make_token(sub=uuid.uuid4())

    response = client.get("/auth/me", headers=auth_header(token))

    assert response.status_code == 404
    assert response.json()["detail"] == "No profile exists for this user."


def test_non_uuid_subject_is_rejected(client: TestClient, make_token):
    token = make_token(sub="not-a-uuid")

    response = client.get("/auth/me", headers=auth_header(token))

    assert response.status_code == 401


def test_me_is_scoped_to_the_token_subject(client: TestClient, make_token, make_profile):
    make_profile(user_id=uuid.uuid4(), email="someone@example.edu")
    other = make_profile(user_id=uuid.uuid4(), email="target@example.edu")
    token = make_token(sub=other.id)

    response = client.get("/auth/me", headers=auth_header(token))

    # /auth/me is always scoped to the token subject, never to a caller-supplied id.
    assert response.status_code == 200
    assert response.json()["email"] == "target@example.edu"


# ---------------------------------------------------------------------------
# Verification internals
# ---------------------------------------------------------------------------


def test_verify_token_rejects_empty_string():
    with pytest.raises(security.AuthError):
        security.verify_token("")


def test_jwks_client_requires_supabase_url(monkeypatch):
    monkeypatch.setattr(settings, "supabase_url", "")
    security.reset_jwk_client()

    with pytest.raises(security.AuthConfigurationError):
        security.get_jwk_client()
