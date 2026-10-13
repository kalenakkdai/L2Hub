"""Event plans persist, and anonymous reports never name their author."""

from __future__ import annotations

import uuid

from sqlalchemy import select

from app.db.seed import SEED_COMMITTEE_IDS, seed_development_users
from app.models import EventPlanReport


def auth_header(make_token, user_id: uuid.UUID) -> dict[str, str]:
    return {"Authorization": f"Bearer {make_token(sub=user_id)}"}


def test_a_member_can_create_a_plan_and_cannot_enable_it(client, make_token, db_session):
    seeded = seed_development_users(db_session)
    member = auth_header(make_token, seeded["community_member"].id)
    advisor = auth_header(make_token, seeded["senior_advisor_1"].id)

    empty = client.get("/event-plans", headers=member)
    created = client.post(
        "/event-plans",
        headers=member,
        json={"title": "Winter Formal", "summary": "Gym dance", "eventDate": "2026-12-12"},
    )
    denied = client.post(f"/event-plans/{created.json()['id']}/enable", headers=member)
    hidden = client.get("/event-plans", headers=advisor)
    missing = client.get("/event-plans/not-a-plan", headers=member)
    blank = client.post("/event-plans", headers=member, json={"title": " "})

    assert empty.status_code == 200, empty.text
    assert empty.json() == []
    assert created.status_code == 200, created.text
    assert created.json()["status"] == "draft"
    assert created.json()["createdByName"] == "Avery Chen"
    assert created.json()["eventDate"] == "2026-12-12"
    assert created.json()["agenda"]["title"]
    bridged = client.post(
        "/event-plans",
        headers=member,
        json={
            "title": "From Messenger",
            "summary": "Quad",
            "initialAssignments": [
                {
                    "targetType": "committee",
                    "committeeId": "com-community",
                    "roleLabel": "Setup",
                }
            ],
        },
    )
    assert bridged.status_code == 200, bridged.text
    assert bridged.json()["assignments"][0]["committeeName"] == "Community"
    assert bridged.json()["assignments"][0]["committeeId"] == str(
        SEED_COMMITTEE_IDS["community"]
    )
    assert denied.status_code == 403
    assert hidden.status_code == 403
    assert missing.status_code == 404
    assert blank.status_code == 422
    assert client.get("/event-plans").status_code == 401


def test_enablement_and_acceptance_follow_the_plan_status(client, make_token, db_session):
    seeded = seed_development_users(db_session)
    owner = seeded["community_member"]
    other = seeded["spirit_member"]
    asbo = seeded["asbo"]
    owner_headers = auth_header(make_token, owner.id)
    other_headers = auth_header(make_token, other.id)
    asbo_headers = auth_header(make_token, asbo.id)

    created = client.post(
        "/event-plans",
        headers=owner_headers,
        json={"title": "Maze Day", "summary": "Timed stations"},
    )
    plan_id = created.json()["id"]
    assigned = client.post(
        f"/event-plans/{plan_id}/assignments",
        headers=owner_headers,
        json={
            "targetType": "individual",
            "memberId": str(owner.id),
            "roleLabel": "Station lead",
        },
    )
    outsider = client.post(
        f"/event-plans/{plan_id}/assignments",
        headers=other_headers,
        json={
            "targetType": "individual",
            "memberId": str(other.id),
            "roleLabel": "Floater",
        },
    )
    committee = client.post(
        f"/event-plans/{plan_id}/assignments",
        headers=asbo_headers,
        json={
            "targetType": "committee",
            "committeeId": str(SEED_COMMITTEE_IDS["community"]),
            "roleLabel": "Setup",
        },
    )
    submitted = client.post(f"/event-plans/{plan_id}/submit", headers=owner_headers)
    assignment_id = assigned.json()["assignments"][0]["id"]
    too_soon = client.post(
        f"/event-plans/{plan_id}/assignments/{assignment_id}/accept",
        headers=owner_headers,
    )
    enabled = client.post(f"/event-plans/{plan_id}/enable", headers=asbo_headers)
    refused = client.post(
        f"/event-plans/{plan_id}/assignments/{assignment_id}/accept",
        headers=other_headers,
    )
    accepted = client.post(
        f"/event-plans/{plan_id}/assignments/{assignment_id}/accept",
        headers=owner_headers,
    )
    committee_id = next(
        row["id"]
        for row in committee.json()["assignments"]
        if row["targetType"] == "committee"
    )
    committee_accept = client.post(
        f"/event-plans/{plan_id}/assignments/{committee_id}/accept",
        headers=owner_headers,
    )

    assert assigned.status_code == 200, assigned.text
    assert outsider.status_code == 403
    assert committee.status_code == 200, committee.text
    assert submitted.json()["status"] == "pending_enablement"
    assert too_soon.status_code == 409
    assert enabled.status_code == 200, enabled.text
    assert enabled.json()["status"] == "enabled"
    assert enabled.json()["enabledByName"] == "Taylor Kim"
    assert refused.status_code == 403
    assert accepted.json()["status"] == "active"
    assert committee_accept.json()["status"] == "active"
    accepted_row = next(
        row for row in committee_accept.json()["assignments"] if row["id"] == committee_id
    )
    assert accepted_row["status"] == "accepted"
    assert accepted_row["committeeName"] == "Community"


def test_anonymous_reports_hide_the_author(client, make_token, db_session):
    seeded = seed_development_users(db_session)
    author = seeded["community_member"]
    subject = seeded["spirit_member"]
    author_headers = auth_header(make_token, author.id)
    asbo_headers = auth_header(make_token, seeded["asbo"].id)
    ac_headers = auth_header(make_token, seeded["ac"].id)

    plan_id = client.post(
        "/event-plans",
        headers=author_headers,
        json={"title": "Fall Rally", "summary": "Quad"},
    ).json()["id"]
    filed = client.post(
        f"/event-plans/{plan_id}/reports",
        headers=author_headers,
        json={
            "subjectMemberId": str(subject.id),
            "category": "not_doing_work",
            "details": "The setup shift was missed.",
            "attachments": [
                {
                    "displayName": "Avery Chen phone.png",
                    "mimeType": "image/png",
                    "sizeBytes": 4,
                    "dataUrl": "data:image/png;base64,aaaa",
                }
            ],
        },
    )
    member_list = client.get(f"/event-plans/{plan_id}/reports", headers=author_headers)
    asbo_list = client.get(f"/event-plans/{plan_id}/reports", headers=asbo_headers)
    ac_list = client.get(f"/event-plans/{plan_id}/reports", headers=ac_headers)

    assert filed.status_code == 200, filed.text
    assert author.email not in filed.text
    assert str(author.id) not in filed.text
    assert member_list.status_code == 403
    assert asbo_list.status_code == 403
    assert ac_list.status_code == 200, ac_list.text
    body = ac_list.text
    assert str(author.id) not in body
    assert author.email not in body
    assert "Avery Chen" not in body
    assert "authorId" not in body
    assert "author_user_id" not in body
    assert "Avery Chen phone.png" not in body
    report = ac_list.json()[0]
    assert report["subjectMemberName"] == "Sam Ortiz"
    assert report["subjectMemberId"] == str(subject.id)
    assert report["attachments"][0]["displayName"] == "screenshot-1.png"
    assert "author" not in report
    stored = db_session.scalar(select(EventPlanReport))
    assert stored is not None
    assert stored.author_user_id == author.id


def test_the_directory_lists_campers_without_emails(client, make_token, db_session):
    seeded = seed_development_users(db_session)
    headers = auth_header(make_token, seeded["community_member"].id)
    members = client.get("/event-plans/members", headers=headers)
    committees = client.get("/event-plans/committees", headers=headers)

    assert members.status_code == 200, members.text
    assert "community.member@l2hub.local" not in members.text
    assert any(row["name"] == "Avery Chen" for row in members.json())
    names = {row["name"] for row in committees.json()}
    assert "Community" in names
    assert "Spirit" not in names
