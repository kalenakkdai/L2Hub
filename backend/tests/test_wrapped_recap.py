"""Wrapped presentation gate and the per-event recap it unlocks."""

from __future__ import annotations

import uuid

import pytest

from app.db.seed import seed_development_users

EVENT = "maze-day-2026"


@pytest.fixture
def seeded(db_session):
    return seed_development_users(db_session)


def auth_header(make_token, user_id: uuid.UUID) -> dict[str, str]:
    return {"Authorization": f"Bearer {make_token(sub=user_id)}"}


def publish(client, make_token, seeded) -> dict[str, str]:
    """Generate and publish the Wrapped, returning president headers."""
    headers = auth_header(make_token, seeded["president"].id)
    client.post(f"/events/{EVENT}/summary/generate", headers=headers)
    client.post(f"/events/{EVENT}/summary/publish", headers=headers)
    return headers


def test_recap_is_locked_until_the_class_has_been_through_wrapped(
    client, make_token, seeded
):
    headers = publish(client, make_token, seeded)

    locked = client.get(f"/events/{EVENT}/recap", headers=headers)
    assert locked.status_code == 403
    assert locked.json()["detail"]["code"] == "wrapped_not_presented"

    assert client.post(f"/events/{EVENT}/wrapped/presented", headers=headers).status_code == 200

    unlocked = client.get(f"/events/{EVENT}/recap", headers=headers)
    assert unlocked.status_code == 200
    assert unlocked.json()["presentedAt"] is not None


def test_events_list_reports_whether_wrapped_was_presented(client, make_token, seeded):
    headers = publish(client, make_token, seeded)

    before = client.get("/events", headers=headers).json()["events"]
    maze = next(e for e in before if e["slug"] == EVENT)
    assert maze["wrappedPresentedAt"] is None

    client.post(f"/events/{EVENT}/wrapped/presented", headers=headers)

    after = client.get("/events", headers=headers).json()["events"]
    maze = next(e for e in after if e["slug"] == EVENT)
    assert maze["wrappedPresentedAt"] is not None


def test_only_officers_may_mark_wrapped_presented(client, make_token, seeded):
    publish(client, make_token, seeded)

    for actor in ("community_member", "community_head"):
        denied = client.post(
            f"/events/{EVENT}/wrapped/presented",
            headers=auth_header(make_token, seeded[actor].id),
        )
        assert denied.status_code == 403, actor

    allowed = client.post(
        f"/events/{EVENT}/wrapped/presented",
        headers=auth_header(make_token, seeded["asbo"].id),
    )
    assert allowed.status_code == 200


def test_cannot_present_a_wrapped_that_was_never_generated(client, make_token, seeded):
    headers = auth_header(make_token, seeded["president"].id)
    response = client.post(f"/events/{EVENT}/wrapped/presented", headers=headers)
    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "summary_not_ready"


def test_presenting_twice_keeps_the_first_walkthrough_time(client, make_token, seeded):
    headers = publish(client, make_token, seeded)

    first = client.post(f"/events/{EVENT}/wrapped/presented", headers=headers).json()
    second = client.post(f"/events/{EVENT}/wrapped/presented", headers=headers).json()

    assert first["presentedAt"] == second["presentedAt"]


def test_member_sees_the_recap_only_after_publish_and_presentation(
    client, make_token, seeded
):
    president = auth_header(make_token, seeded["president"].id)
    member = auth_header(make_token, seeded["community_member"].id)

    client.post(f"/events/{EVENT}/summary/generate", headers=president)
    # Draft Wrapped stays invisible to members even once it is presented.
    client.post(f"/events/{EVENT}/wrapped/presented", headers=president)
    assert client.get(f"/events/{EVENT}/recap", headers=member).status_code == 403

    client.post(f"/events/{EVENT}/summary/publish", headers=president)
    assert client.get(f"/events/{EVENT}/recap", headers=member).status_code == 200


def test_recap_carries_headlines_without_contributor_identities(
    client, make_token, seeded
):
    headers = publish(client, make_token, seeded)
    client.post(f"/events/{EVENT}/wrapped/presented", headers=headers)

    recap = client.get(f"/events/{EVENT}/recap", headers=headers).json()

    assert recap["hero"]["title"].startswith("Maze Day")
    assert recap["overallRating"]["score"] > 0
    assert recap["participation"]["completionPercent"] == 96
    assert recap["committeeRankings"]
    assert recap["topImprovements"]
    assert recap["recommendedActions"]

    for theme in recap["topStrengths"] + recap["topImprovements"]:
        assert set(theme) == {"id", "label", "mentions", "summary"}
        assert "contributors" not in theme

    # No quote, name, or committee attribution leaks through the recap.
    wrapped = client.get(f"/events/{EVENT}/wrapped", headers=headers).json()
    names = {
        contributor["name"]
        for theme in wrapped["graph"]["themes"]
        for contributor in theme["contributors"]
        if contributor["name"]
    }
    assert names
    body = str(recap)
    for name in names:
        assert name not in body


def test_recap_is_404_for_an_unknown_event(client, make_token, seeded):
    headers = auth_header(make_token, seeded["president"].id)
    assert client.get("/events/not-an-event/recap", headers=headers).status_code == 404


def test_asbo_keeps_present_but_still_cannot_publish(client, make_token, seeded):
    from app.core import permission_keys as pk
    from app.core.role_catalog import ASBO_PERMISSIONS

    assert pk.WRAPPED_PRESENT in ASBO_PERMISSIONS
    assert pk.WRAPPED_PUBLISH not in ASBO_PERMISSIONS

    publish(client, make_token, seeded)
    asbo = auth_header(make_token, seeded["asbo"].id)
    assert client.post(f"/events/{EVENT}/summary/publish", headers=asbo).status_code == 403


def test_members_and_heads_never_receive_the_present_permission():
    from app.core import permission_keys as pk
    from app.core.role_catalog import COMMITTEE_HEAD_PERMISSIONS, MEMBER_PERMISSIONS

    assert pk.WRAPPED_PRESENT not in MEMBER_PERMISSIONS
    assert pk.WRAPPED_PRESENT not in COMMITTEE_HEAD_PERMISSIONS
