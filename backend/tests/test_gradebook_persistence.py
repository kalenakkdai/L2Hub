"""Persisted gradebook: create → grade → publish → student visibility."""

from __future__ import annotations

import uuid

import pytest

from app.db.seed import seed_development_users


@pytest.fixture
def seeded(db_session):
    return seed_development_users(db_session)


def auth_header(make_token, user_id: uuid.UUID) -> dict[str, str]:
    return {"Authorization": f"Bearer {make_token(sub=user_id)}"}


def test_member_cannot_create_assignment(client, make_token, seeded):
    headers = auth_header(make_token, seeded["community_member"].id)
    response = client.post(
        "/grades/assignments",
        json={
            "title": "Maze Day Debrief",
            "categoryId": "cat-debriefs",
            "pointsPossible": 20,
        },
        headers=headers,
    )
    assert response.status_code == 403


def test_operator_create_grade_publish_student_sees(
    client, make_token, seeded
):
    jan = auth_header(make_token, seeded["ac"].id)
    member = seeded["community_member"]
    member_headers = auth_header(make_token, member.id)

    created = client.post(
        "/grades/assignments",
        json={
            "title": "Maze Day Debrief",
            "categoryId": "cat-debriefs",
            "pointsPossible": 20,
            "assignmentType": "event_debrief",
        },
        headers=jan,
    )
    assert created.status_code == 201, created.text
    assignment_id = created.json()["assignment"]["id"]

    before = client.get("/grades/me", headers=member_headers)
    assert before.status_code == 200
    assert before.json()["entries"] == []

    roster = client.get(
        f"/grades/assignments/{assignment_id}/roster", headers=jan
    )
    assert roster.status_code == 200
    row = next(
        r for r in roster.json()["rows"] if r["studentId"] == str(member.id)
    )
    entry_id = row["entryId"]

    graded = client.post(
        f"/grades/entries/{entry_id}/grade",
        json={"score": 18, "status": "graded"},
        headers=jan,
    )
    assert graded.status_code == 200, graded.text
    assert graded.json()["publicationStatus"] == "pending_publish"

    still_hidden = client.get("/grades/me", headers=member_headers)
    assert still_hidden.json()["entries"] == []

    published = client.post(
        "/grades/publish",
        json={"entryIds": [entry_id]},
        headers=jan,
    )
    assert published.status_code == 200
    assert published.json()["publishedCount"] == 1

    mine = client.get("/grades/me", headers=member_headers)
    assert mine.status_code == 200
    body = mine.json()
    assert len(body["entries"]) == 1
    assert body["entries"][0]["score"] == 18
    assert body["entries"][0]["publicationStatus"] == "published"
    assert body["summary"]["earnedPoints"] == 18
    assert body["summary"]["possiblePoints"] == 20
    assert body["summary"]["weightedPercent"] == 90.0

    dash = client.get("/dashboard", headers=member_headers)
    assert dash.status_code == 200
    stats = dash.json()["stats"]
    assert stats["gradeLetter"] == "A−"
    assert stats["gradePercent"] == 90.0
    assert dash.json()["grades"]["pointsEarned"] == 18


def test_bulk_grade_and_pending_queue(client, make_token, seeded):
    jan = auth_header(make_token, seeded["ac"].id)
    created = client.post(
        "/grades/assignments",
        json={
            "title": "Reflection 1",
            "categoryId": "cat-reflections",
            "pointsPossible": 10,
        },
        headers=jan,
    )
    assignment_id = created.json()["assignment"]["id"]
    roster = client.get(
        f"/grades/assignments/{assignment_id}/roster", headers=jan
    ).json()["rows"]
    items = [
        {"entryId": row["entryId"], "score": 9}
        for row in roster[:2]
    ]
    bulk = client.post(
        "/grades/entries/bulk-grade",
        json={"items": items},
        headers=jan,
    )
    assert bulk.status_code == 200
    assert bulk.json()["gradedCount"] == 2

    pending = client.get("/grades/pending", headers=jan)
    assert pending.status_code == 200
    assert len(pending.json()["entries"]) >= 2


def test_asbo_non_operator_denied_assign(client, make_token, seeded):
    """Taylor (ASBO) is not Jan/Jadon — assign is denied at the operator gate."""
    headers = auth_header(make_token, seeded["asbo"].id)
    response = client.post(
        "/grades/assignments",
        json={
            "title": "Should fail",
            "categoryId": "cat-debriefs",
            "pointsPossible": 5,
        },
        headers=headers,
    )
    assert response.status_code == 403


def test_every_member_can_propose_and_only_operators_see_all(
    client, make_token, seeded
):
    member = seeded["community_member"]
    other = seeded["spirit_member"]
    jan = seeded["ac"]

    proposal = client.post(
        "/grades/assignment-requests",
        json={
            "title": "Community event reflection",
            "description": "A short reflection after the event.",
            "proposedCategoryId": "cat-reflections",
            "proposedPoints": 10,
        },
        headers=auth_header(make_token, member.id),
    )
    assert proposal.status_code == 201, proposal.text
    proposal_id = proposal.json()["id"]
    assert proposal.json()["status"] == "pending"

    mine = client.get(
        "/grades/assignment-requests",
        headers=auth_header(make_token, member.id),
    )
    assert [row["id"] for row in mine.json()["requests"]] == [proposal_id]

    someone_else = client.get(
        "/grades/assignment-requests",
        headers=auth_header(make_token, other.id),
    )
    assert someone_else.json()["requests"] == []

    all_proposals = client.get(
        "/grades/assignment-requests",
        headers=auth_header(make_token, jan.id),
    )
    assert [row["id"] for row in all_proposals.json()["requests"]] == [proposal_id]


def test_jan_approval_creates_assignment_and_cannot_review_twice(
    client, make_token, seeded
):
    member_headers = auth_header(make_token, seeded["community_member"].id)
    jan_headers = auth_header(make_token, seeded["ac"].id)
    proposal = client.post(
        "/grades/assignment-requests",
        json={
            "title": "Approved reflection",
            "proposedCategoryId": "cat-reflections",
            "proposedPoints": 12,
        },
        headers=member_headers,
    ).json()

    approved = client.post(
        f"/grades/assignment-requests/{proposal['id']}/review",
        json={"decision": "approve", "note": "Add this to the quarter."},
        headers=jan_headers,
    )
    assert approved.status_code == 200, approved.text
    body = approved.json()
    assert body["status"] == "approved"
    assert body["createdAssignmentId"] == body["assignment"]["id"]

    roster = client.get(
        f"/grades/assignments/{body['createdAssignmentId']}/roster",
        headers=jan_headers,
    )
    assert roster.status_code == 200
    assert roster.json()["assignmentTitle"] == "Approved reflection"
    assert roster.json()["completionTotal"] > 0

    second_review = client.post(
        f"/grades/assignment-requests/{proposal['id']}/review",
        json={"decision": "reject"},
        headers=jan_headers,
    )
    assert second_review.status_code == 409
