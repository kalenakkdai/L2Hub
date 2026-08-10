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


def test_committee_head_grades_all_forbidden_but_can_request_and_committee_grade(
    client, make_token, seeded
):
    headers = auth_header(make_token, seeded["community_head"].id)
    assert client.get("/grades/all", headers=headers).status_code == 403
    assert client.get("/grades/pending", headers=headers).status_code == 403
    assert (
        client.post(
            "/grades/assignments",
            headers=headers,
            json={
                "title": "Head should not create",
                "categoryId": "cat-deliverables",
                "pointsPossible": 10,
            },
        ).status_code
        == 403
    )
    # Heads may not grade individual assignment entries.
    entry_id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    assert (
        client.post(
            f"/grades/entries/{entry_id}/grade",
            headers=headers,
            json={"score": 5, "status": "graded"},
        ).status_code
        == 403
    )
    # Heads may send draft assignment requests and enter committee-category grades.
    assert client.get("/grades/assignment-requests", headers=headers).status_code == 200
    req = client.post(
        "/grades/assignment-requests",
        headers=headers,
        json={"title": "Spirit Week checklist", "proposedPoints": 10},
    )
    assert req.status_code == 201
    assert req.json()["status"] == "pending"
    community = seeded["community_head"]
    from app.db.seed import SEED_COMMITTEE_IDS

    committee_id = str(SEED_COMMITTEE_IDS["community"])
    batch = client.post(
        "/grades/committee-grades",
        headers=headers,
        json={
            "committeeId": committee_id,
            "scores": [{"studentId": str(community.id), "score": 9}],
        },
    )
    assert batch.status_code == 201
    assert batch.json()["categoryId"] == "cat-committee-grades"


def test_jan_and_jadon_can_assign_publish_and_grade(
    client, make_token, seeded, db_session
):
    from sqlalchemy import select

    from app.models import Notification

    jan = auth_header(make_token, seeded["ac"].id)
    jadon = auth_header(make_token, seeded["president"].id)

    assert client.get("/grades/pending", headers=jan).status_code == 200

    # Jadon configures an assignment; every active camper is enrolled.
    created = client.post(
        "/grades/assignments",
        headers=jadon,
        json={
            "title": "Leadership check-in",
            "categoryId": "cat-deliverables",
            "pointsPossible": 10,
        },
    )
    assert created.status_code == 201, created.text
    assignment_id = created.json()["assignment"]["id"]

    roster = client.get(f"/grades/assignments/{assignment_id}/roster", headers=jan)
    assert roster.status_code == 200
    entry_ids = [row["entryId"] for row in roster.json()["rows"]]
    assert len(entry_ids) >= 2

    # Jadon grades one entry, Jan grades another.
    assert (
        client.post(
            f"/grades/entries/{entry_ids[0]}/grade",
            headers=jadon,
            json={"score": 9, "status": "graded"},
        ).status_code
        == 200
    )
    assert (
        client.post(
            f"/grades/entries/{entry_ids[1]}/grade",
            headers=jan,
            json={"score": 8, "status": "graded"},
        ).status_code
        == 200
    )

    # Jan publishes the graded entries.
    assert (
        client.post(
            "/grades/publish",
            json={"entryIds": entry_ids[:2]},
            headers=jan,
        ).status_code
        == 200
    )

    # Jadon bulk-grades an entry.
    assert (
        client.post(
            "/grades/entries/bulk-grade",
            headers=jadon,
            json={
                "items": [
                    {"entryId": entry_ids[0], "score": 10, "status": "graded"},
                ]
            },
        ).status_code
        == 200
    )

    # A member proposal, approved by Jan, becomes a real assignment.
    proposal = client.post(
        "/grades/assignment-requests",
        headers=auth_header(make_token, seeded["community_member"].id),
        json={
            "title": "Member idea",
            "proposedCategoryId": "cat-reflections",
            "proposedPoints": 5,
        },
    )
    assert proposal.status_code == 201, proposal.text
    assert (
        client.post(
            f"/grades/assignment-requests/{proposal.json()['id']}/review",
            headers=jan,
            json={"decision": "approve"},
        ).status_code
        == 200
    )

    # Transparency: each operator is notified about the other's writes.
    jan_types = [
        n.type
        for n in db_session.scalars(
            select(Notification).where(
                Notification.recipient_user_id == seeded["ac"].id
            )
        ).all()
        if n.type == "grades.changed"
    ]
    jadon_types = [
        n.type
        for n in db_session.scalars(
            select(Notification).where(
                Notification.recipient_user_id == seeded["president"].id
            )
        ).all()
        if n.type == "grades.changed"
    ]
    assert jan_types  # Jadon assigned + graded
    assert jadon_types  # Jan published + graded


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
    users = response.json()["users"]
    emails = {user["email"] for user in users}
    names = {user["full_name"] for user in users}
    assert "ac@l2hub.local" in emails
    assert "asbo@l2hub.local" in emails
    assert "community.head@l2hub.local" in emails
    # Spreadsheet campers appear even before they sign up.
    assert "Hanna Rahmanian" in names
    assert "Samay Jain" in names
    pending = [u for u in users if u.get("account_linked") is False]
    assert len(pending) >= 40
    assert all(u["status"] == "awaiting_signup" for u in pending)


def test_member_cannot_open_users_admin(client, make_token, seeded):
    headers = auth_header(make_token, seeded["community_member"].id)
    assert client.get("/admin/users", headers=headers).status_code == 403


def test_asbo_can_open_users_admin(client, make_token, seeded):
    headers = auth_header(make_token, seeded["asbo"].id)
    response = client.get("/admin/users", headers=headers)
    assert response.status_code == 200
    assert "users" in response.json()


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
