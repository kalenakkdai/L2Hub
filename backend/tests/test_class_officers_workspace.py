"""Class Officers workspaces stay inside their cohort and start from zero raised."""

from __future__ import annotations

import uuid

import pytest

from app.db.seed import seed_development_users


@pytest.fixture
def seeded(db_session):
    return seed_development_users(db_session)


def auth_header(make_token, user_id: uuid.UUID) -> dict[str, str]:
    return {"Authorization": f"Bearer {make_token(sub=user_id)}"}


def test_a_senior_officer_reads_an_empty_goal_and_cannot_open_junior(
    client, make_token, seeded
):
    headers = auth_header(make_token, seeded["senior_class_officer"].id)
    senior = client.get("/class-officers/senior", headers=headers)
    junior = client.get("/class-officers/junior", headers=headers)

    assert senior.status_code == 200, senior.text
    body = senior.json()
    assert body["cohort"] == "senior"
    assert body["fundraiser"]["raisedCents"] == 0
    assert body["fundraiser"]["targetCents"] == 800_000
    assert body["fundraiser"]["milestones"][-1] == 8000
    assert body["homecoming"]["skitTheme"] == ""
    assert body["homecoming"]["checkpoints"] == []
    assert junior.status_code == 403
    assert junior.json()["detail"]["code"] == "class_cohort_denied"


def test_updating_senior_does_not_change_junior(client, make_token, seeded):
    asbo = auth_header(make_token, seeded["asbo"].id)
    saved = client.patch(
        "/class-officers/senior/fundraiser",
        headers=asbo,
        json={"raisedCents": 125000, "label": "Winter Ball tickets"},
    )
    junior = client.get("/class-officers/junior", headers=asbo)

    assert saved.status_code == 200, saved.text
    assert saved.json()["raisedCents"] == 125000
    assert saved.json()["label"] == "Winter Ball tickets"
    assert junior.json()["fundraiser"]["raisedCents"] == 0
    assert junior.json()["fundraiser"]["targetCents"] == 600_000

    again = client.get("/class-officers/senior", headers=asbo)
    assert again.json()["fundraiser"]["raisedCents"] == 125000


def test_a_homecoming_edit_is_stored(client, make_token, seeded):
    headers = auth_header(make_token, seeded["junior_class_officer"].id)
    saved = client.patch(
        "/class-officers/junior/homecoming",
        headers=headers,
        json={
            "skitTheme": "Neon Arcade",
            "skitActors": [{"id": "person-0", "name": "Sofie Pan", "note": "Lead"}],
            "checkpoints": [
                {
                    "id": "cp-1",
                    "date": "2026-10-20",
                    "title": "Dress rehearsal",
                    "detail": "Gym",
                    "status": "upcoming",
                }
            ],
        },
    )

    assert saved.status_code == 200, saved.text
    assert saved.json()["skitTheme"] == "Neon Arcade"
    assert saved.json()["skitActors"][0]["name"] == "Sofie Pan"
    assert saved.json()["checkpoints"][0]["status"] == "upcoming"

    senior = client.get(
        "/class-officers/senior",
        headers=auth_header(make_token, seeded["asbo"].id),
    )
    assert senior.json()["homecoming"]["skitTheme"] == ""


def test_an_advisor_can_read_but_not_edit(client, make_token, seeded):
    headers = auth_header(make_token, seeded["senior_advisor_1"].id)
    read = client.get("/class-officers/senior", headers=headers)
    write = client.patch(
        "/class-officers/senior/fundraiser",
        headers=headers,
        json={"raisedCents": 100},
    )
    other = client.get("/class-officers/junior", headers=headers)

    assert read.status_code == 200, read.text
    assert read.json()["advisors"]
    assert write.status_code == 403
    assert other.status_code == 403


def test_a_member_and_a_missing_cohort_are_refused(client, make_token, seeded):
    headers = auth_header(make_token, seeded["community_member"].id)
    assert client.get("/class-officers/senior", headers=headers).status_code == 403
    assert (
        client.get(
            "/class-officers/nope",
            headers=auth_header(make_token, seeded["asbo"].id),
        ).status_code
        == 404
    )
    assert client.get("/class-officers/senior").status_code == 401


def test_a_negative_total_is_rejected(client, make_token, seeded):
    response = client.patch(
        "/class-officers/senior/fundraiser",
        headers=auth_header(make_token, seeded["senior_class_officer"].id),
        json={"raisedCents": -1},
    )
    assert response.status_code == 422
