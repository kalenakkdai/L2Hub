import uuid

import pytest

from app.core.permissions import ROLE_ORDER


def test_me_returns_the_caller_profile(client, make_token, make_profile):
    profile = make_profile(email="ada@example.edu", full_name="Ada L", role="asbo")
    response = client.get(
        "/auth/me", headers={"Authorization": f"Bearer {make_token(sub=profile.id)}"}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["id"] == str(profile.id)
    assert body["email"] == "ada@example.edu"
    assert body["full_name"] == "Ada L"
    assert body["role"] == "asbo"
    assert "permissions" in body
    assert "roles" in body
    assert set(body) >= {"id", "email", "full_name", "role", "created_at", "permissions", "roles"}


@pytest.mark.parametrize("role", ROLE_ORDER)
def test_every_role_round_trips_through_the_response_schema(
    client, make_token, make_profile, role
):
    profile = make_profile(user_id=uuid.uuid4(), role=role)
    response = client.get(
        "/auth/me", headers={"Authorization": f"Bearer {make_token(sub=profile.id)}"}
    )
    assert response.status_code == 200
    assert response.json()["role"] == role


def test_unknown_role_name_does_not_create_an_assignment(
    client, make_token, make_profile
):
    profile = make_profile(role="unknown")
    response = client.get(
        "/auth/me", headers={"Authorization": f"Bearer {make_token(sub=profile.id)}"}
    )
    assert response.status_code == 200
    assert response.json()["role"] == "member"


def test_role_comes_from_the_database_not_the_token(client, make_token, make_profile):
    profile = make_profile(role="member")
    for claimed in ("ac", "president", "asbo"):
        response = client.get(
            "/auth/me",
            headers={
                "Authorization": f"Bearer {make_token(sub=profile.id, user_role=claimed, app_metadata={'role': claimed}, user_metadata={'role': claimed})}"
            },
        )
        assert response.status_code == 200
        assert response.json()["role"] == "member"
