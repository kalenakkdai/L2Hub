"""The committees directory — the page every camper can open."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select

from app.db.l2_roster import L2_ROSTER_COMMITTEES
from app.db.seed import seed_development_users
from app.models import Committee, Event, Task

COMMUNITY = "community"


@pytest.fixture
def seeded(db_session):
    return seed_development_users(db_session)


def auth_header(make_token, user_id: uuid.UUID) -> dict[str, str]:
    return {"Authorization": f"Bearer {make_token(sub=user_id)}"}


def test_a_member_sees_the_twelve_committees_and_which_one_is_theirs(
    client, make_token, seeded
):
    response = client.get(
        "/committees", headers=auth_header(make_token, seeded["community_member"].id)
    )

    assert response.status_code == 200, response.text
    body = response.json()
    slugs = [row["id"] for row in body["committees"]]
    assert slugs == [slug for slug, *_rest in L2_ROSTER_COMMITTEES]
    assert "spirit" not in slugs

    community = next(row for row in body["committees"] if row["id"] == COMMUNITY)
    assert community["isMine"] is True
    assert community["head"] == "Jordan Lee"
    assert community["email"] == "msjcommunity21.22@gmail.com"
    assert community["camperCount"] >= 1
    assert body["camperTotal"] >= community["camperCount"]

    others = [row for row in body["committees"] if row["id"] != COMMUNITY]
    assert all(row["isMine"] is False for row in others)


def test_the_detail_lists_real_members_tasks_and_only_current_events(
    client, make_token, seeded, db_session
):
    committee = db_session.scalar(select(Committee).where(Committee.slug == COMMUNITY))
    assert committee is not None
    now = datetime.now(UTC)
    db_session.add(
        Task(
            committee_id=committee.id,
            title="Confirm the booth layout",
            status="doing",
            assignee_user_id=seeded["community_head"].id,
            due_on=(now + timedelta(days=3)).date(),
            created_by_user_id=seeded["community_head"].id,
        )
    )
    db_session.add(
        Event(
            name="Community Night",
            slug=f"community-night-{uuid.uuid4().hex[:8]}",
            year=now.year,
            status="scheduled",
            location="Quad",
            starts_at=now + timedelta(days=14),
            managing_committee_id=committee.id,
        )
    )
    db_session.add(
        Event(
            name="Last Year's Fair",
            slug=f"old-fair-{uuid.uuid4().hex[:8]}",
            year=now.year - 1,
            status="completed",
            starts_at=now - timedelta(days=400),
            ends_at=now - timedelta(days=399),
            managing_committee_id=committee.id,
        )
    )
    db_session.commit()

    response = client.get(
        f"/committees/{COMMUNITY}",
        headers=auth_header(make_token, seeded["asbo"].id),
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["name"] == "Community"
    assert body["remainingCount"] == 0
    names = [member["name"] for member in body["members"]]
    assert names[0] == "Jordan Lee"
    assert body["members"][0]["isHead"] is True
    assert body["tasks"][0]["title"] == "Confirm the booth layout"
    assert body["tasks"][0]["status"] == "In progress"
    assert "Jordan Lee" in body["tasks"][0]["meta"]
    titles = [event["title"] for event in body["events"]]
    assert titles == ["Community Night"]
    assert body["events"][0]["detail"] == "Quad"


def test_an_unknown_committee_is_not_found(client, make_token, seeded):
    response = client.get(
        "/committees/not-a-committee",
        headers=auth_header(make_token, seeded["ac"].id),
    )

    assert response.status_code == 404


def test_a_class_advisor_cannot_open_the_directory(client, make_token, seeded):
    response = client.get(
        "/committees",
        headers=auth_header(make_token, seeded["senior_advisor_1"].id),
    )

    assert response.status_code == 403


def test_the_directory_requires_a_session(client):
    assert client.get("/committees").status_code == 401
