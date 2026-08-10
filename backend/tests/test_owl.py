"""Letter grades and A+-gated owl cosmetics."""

from __future__ import annotations

import pytest
from sqlalchemy import select

from app.db.seed import seed_development_users
from app.models import Notification
from app.services.letter_grade import is_a_plus, letter_grade


@pytest.fixture
def seeded(db_session):
    return seed_development_users(db_session)


def auth_header(make_token, user_id) -> dict[str, str]:
    return {"Authorization": f"Bearer {make_token(sub=user_id)}"}


def test_letter_grade_bands():
    assert letter_grade(97) == "A+"
    assert letter_grade(96.9) == "A"
    assert letter_grade(90) == "A−"
    assert is_a_plus(97) is True
    assert is_a_plus(96.9) is False
    assert is_a_plus(None) is False


def test_owl_unlocks_at_a_plus_and_awards_points(client, make_token, seeded):
    headers = auth_header(make_token, seeded["community_member"].id)
    synced = client.post(
        "/owl/eligibility/sync",
        headers=headers,
        json={"weightedPercent": 98.5},
    )
    assert synced.status_code == 200, synced.text
    body = synced.json()
    assert body["eligible"] is True
    assert body["accessActive"] is True
    assert body["letterGrade"] == "A+"
    assert body["points"] == 100
    assert body["change"]["unlocked"] is True


def test_owl_revoke_notifies_when_grade_drops(client, make_token, seeded, db_session):
    member = seeded["community_member"]
    headers = auth_header(make_token, member.id)
    assert (
        client.post(
            "/owl/eligibility/sync",
            headers=headers,
            json={"weightedPercent": 99},
        ).status_code
        == 200
    )

    dropped = client.post(
        "/owl/eligibility/sync",
        headers=headers,
        json={"weightedPercent": 92},
    )
    assert dropped.status_code == 200
    body = dropped.json()
    assert body["eligible"] is False
    assert body["accessActive"] is False
    assert body["change"]["revoked"] is True
    assert body["letterGrade"] == "A−"

    notes = db_session.scalars(
        select(Notification).where(Notification.recipient_user_id == member.id)
    ).all()
    assert any(n.type == "owl.access_revoked" for n in notes)
    revoked = next(n for n in notes if n.type == "owl.access_revoked")
    assert "Owl customization paused" in revoked.title
    assert revoked.payload_json and "/owl" in revoked.payload_json


def test_cosmetics_require_a_plus(client, make_token, seeded):
    headers = auth_header(make_token, seeded["community_member"].id)
    client.post(
        "/owl/eligibility/sync",
        headers=headers,
        json={"weightedPercent": 88},
    )
    refused = client.patch(
        "/owl/cosmetics",
        headers=headers,
        json={"bellyColor": "gold"},
    )
    assert refused.status_code == 403
    assert refused.json()["detail"]["code"] == "owl_access_denied"


def test_a_plus_can_spend_points_on_cosmetics(client, make_token, seeded):
    headers = auth_header(make_token, seeded["community_member"].id)
    client.post(
        "/owl/eligibility/sync",
        headers=headers,
        json={"weightedPercent": 100},
    )
    updated = client.patch(
        "/owl/cosmetics",
        headers=headers,
        json={"bellyColor": "gold", "accessory": "scarf"},
    )
    assert updated.status_code == 200, updated.text
    body = updated.json()
    assert body["cosmetics"]["bellyColor"] == "gold"
    assert body["cosmetics"]["accessory"] == "scarf"
    # 100 welcome − 40 gold − 30 scarf
    assert body["points"] == 30

    # Re-applying an owned unlock is free.
    again = client.patch(
        "/owl/cosmetics",
        headers=headers,
        json={"bellyColor": "snow"},
    )
    assert again.status_code == 200
    assert again.json()["points"] == 30
    back = client.patch(
        "/owl/cosmetics",
        headers=headers,
        json={"bellyColor": "gold"},
    )
    assert back.status_code == 200
    assert back.json()["points"] == 30
