"""Unit tests for baby shadow duration requests."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

import pytest

from app.db.seed import (
    SEED_COMMITTEE_IDS,
    seed_committees,
    seed_development_users,
    seed_permissions_and_roles,
)
from app.models import CommitteeMembership, Profile
from app.models.shadow import ShadowRequest
from app.services import shadow as shadow_service


@pytest.fixture
def seeded(db_session):
    return seed_development_users(db_session)


def auth_header(make_token, user_id: uuid.UUID) -> dict[str, str]:
    return {"Authorization": f"Bearer {make_token(sub=user_id)}"}


def _make_baby(db_session, committee_id) -> Profile:
    baby = Profile(
        id=uuid.uuid4(),
        email="baby@l2hub.local",
        full_name="Baby Camper",
        status="active",
    )
    db_session.add(baby)
    db_session.flush()
    db_session.add(
        CommitteeMembership(
            user_id=baby.id,
            committee_id=committee_id,
            membership_type="baby",
            is_head=False,
        )
    )
    db_session.commit()
    return baby


def test_baby_can_request_and_head_approves(client, make_token, seeded, db_session):
    community = SEED_COMMITTEE_IDS["community"]
    head = seeded["community_head"]
    for m in head.committee_memberships:
        if m.committee_id == community:
            m.is_head = True
            m.membership_type = "head"
    db_session.commit()

    baby = _make_baby(db_session, community)
    headers = auth_header(make_token, baby.id)

    created = client.post(
        "/shadow",
        headers=headers,
        json={"committee_id": str(community), "duration_minutes": 60},
    )
    assert created.status_code == 200, created.text
    body = created.json()
    assert body["status"] == "pending"
    request_id = body["id"]

    member_headers = auth_header(make_token, seeded["community_member"].id)
    denied = client.post(
        f"/shadow/{request_id}/respond",
        headers=member_headers,
        json={"decision": "approved"},
    )
    assert denied.status_code == 403

    head_headers = auth_header(make_token, head.id)
    approved = client.post(
        f"/shadow/{request_id}/respond",
        headers=head_headers,
        json={"decision": "approved"},
    )
    assert approved.status_code == 200, approved.text
    assert approved.json()["status"] == "approved"
    assert approved.json()["ends_at"] is not None

    me = client.get("/auth/me", headers=headers).json()
    assert me["is_baby"] is True
    assert any(s["committee_id"] == str(community) for s in me["active_shadows"])


def test_non_baby_cannot_request(client, make_token, seeded):
    community = SEED_COMMITTEE_IDS["community"]
    headers = auth_header(make_token, seeded["community_member"].id)
    response = client.post(
        "/shadow",
        headers=headers,
        json={"committee_id": str(community), "duration_minutes": 30},
    )
    assert response.status_code == 403


def test_active_shadow_committee_ids_expire(db_session, seeded):
    seed_permissions_and_roles(db_session)
    committees = seed_committees(db_session)
    community = committees["community"]
    baby = _make_baby(db_session, community.id)
    row = ShadowRequest(
        requester_id=baby.id,
        committee_id=community.id,
        duration_minutes=30,
        status="approved",
        starts_at=datetime.now(UTC) - timedelta(hours=2),
        ends_at=datetime.now(UTC) - timedelta(minutes=1),
    )
    db_session.add(row)
    db_session.commit()

    assert shadow_service.active_shadow_committee_ids(db_session, baby.id) == set()
    shadow_service.expire_stale_grants(db_session)
    db_session.refresh(row)
    assert row.status == "expired"
