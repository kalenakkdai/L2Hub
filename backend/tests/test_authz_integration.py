"""Integration tests for protected authorization endpoints."""

from __future__ import annotations

import uuid

import pytest

from app.db.seed import seed_development_users


@pytest.fixture
def seeded(db_session):
    return seed_development_users(db_session)


def auth_header(make_token, user_id: uuid.UUID) -> dict[str, str]:
    return {"Authorization": f"Bearer {make_token(sub=user_id)}"}


def test_asbo_grades_all_ok_feedback_forbidden(client, make_token, seeded):
    headers = auth_header(make_token, seeded["asbo"].id)
    assert client.get("/grades/all", headers=headers).status_code == 200
    private = client.get("/feedback/private", headers=headers)
    assert private.status_code == 403
    assert private.json()["detail"]["code"] == "permission_denied"
    anonymous = client.get("/feedback/anonymous", headers=headers)
    assert anonymous.status_code == 403


def test_committee_head_scoped_tasks(client, make_token, seeded):
    headers = auth_header(make_token, seeded["community_head"].id)
    own = client.get("/committees/community/tasks", headers=headers)
    assert own.status_code == 200
    other = client.get("/committees/spirit/tasks", headers=headers)
    assert other.status_code == 403
    assert other.json()["detail"]["code"] == "committee_scope_denied"


def test_committee_head_grades_all_forbidden(client, make_token, seeded):
    headers = auth_header(make_token, seeded["community_head"].id)
    assert client.get("/grades/all", headers=headers).status_code == 403


def test_member_own_grades_ok_other_forbidden(client, make_token, seeded):
    member = seeded["community_member"]
    other = seeded["spirit_member"]
    headers = auth_header(make_token, member.id)
    assert client.get("/grades/me", headers=headers).status_code == 200
    assert client.get(f"/grades/users/{member.id}", headers=headers).status_code == 200
    denied = client.get(f"/grades/users/{other.id}", headers=headers)
    assert denied.status_code == 403


def test_ac_can_access_protected_families(client, make_token, seeded):
    headers = auth_header(make_token, seeded["ac"].id)
    assert client.get("/grades/all", headers=headers).status_code == 200
    assert client.get("/feedback/private", headers=headers).status_code == 200
    assert client.get("/feedback/anonymous", headers=headers).status_code == 200
    assert client.get("/committees/community/tasks", headers=headers).status_code == 200
    assert client.get("/committees/spirit/tasks", headers=headers).status_code == 200
    assert client.get("/admin/users", headers=headers).status_code == 200


def test_users_page_lists_seeded_accounts_for_ac(client, make_token, seeded):
    headers = auth_header(make_token, seeded["ac"].id)
    response = client.get("/admin/users", headers=headers)
    assert response.status_code == 200
    emails = {user["email"] for user in response.json()["users"]}
    assert "ac@l2hub.local" in emails
    assert "asbo@l2hub.local" in emails
    assert "community.head@l2hub.local" in emails


def test_member_cannot_open_users_admin(client, make_token, seeded):
    headers = auth_header(make_token, seeded["community_member"].id)
    assert client.get("/admin/users", headers=headers).status_code == 403


def test_auth_me_includes_permissions(client, make_token, seeded):
    headers = auth_header(make_token, seeded["asbo"].id)
    body = client.get("/auth/me", headers=headers).json()
    assert body["role"] == "asbo"
    assert "grades.view_all" in body["permissions"]
    assert "feedback.view_private" not in body["permissions"]


def test_dashboard_endpoint_modules(client, make_token, seeded):
    headers = auth_header(make_token, seeded["ac"].id)
    body = client.get("/auth/dashboard", headers=headers).json()
    keys = {module["key"] for module in body["modules"]}
    assert "feedback_review" in keys
    assert "user_management" in keys
