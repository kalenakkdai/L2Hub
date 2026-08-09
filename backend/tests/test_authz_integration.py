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


def test_every_camper_reads_every_committees_tasks(client, make_token, seeded):
    """tasks.view_all is in the Member baseline, so the board is open to all.

    This reverses the original rule, which scoped even a Committee Head to
    their own committee's task list. The L2 Board exists so the whole class can
    see what each committee is working on; a camper who cannot read Spirit's
    column cannot use it.

    Reading is the part that opened up. Writing did not — see
    tests/test_board_and_requests.py, where a head is still refused when adding
    a task to a committee they are not in.
    """
    for who in ("community_member", "community_head", "ac"):
        headers = auth_header(make_token, seeded[who].id)
        assert client.get("/committees/community/tasks", headers=headers).status_code == 200, who
        assert client.get("/committees/spirit/tasks", headers=headers).status_code == 200, who


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


def test_users_list_reports_status_as_stored(client, make_token, seeded, db_session):
    """The roster must not round a missing status up to 'active'.

    _list_item used `profile.status or "active"`. This is the list staff read
    when choosing who to hand administration to, and transfer_admin refuses a
    recipient whose status is not 'active' — so a status the server could not
    read should never be displayed as the one value that unblocks the transfer.
    """
    member = seeded["community_member"]
    member.status = ""
    db_session.flush()

    response = client.get("/admin/users", headers=auth_header(make_token, seeded["ac"].id))

    assert response.status_code == 200
    listed = {user["email"]: user["status"] for user in response.json()["users"]}
    assert listed[member.email] == ""
