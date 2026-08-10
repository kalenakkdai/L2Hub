"""Who is in a committee — the list behind the assignee picker."""

from __future__ import annotations

import uuid

import pytest

from app.db.seed import SEED_COMMITTEE_IDS, seed_development_users

COMMUNITY = str(SEED_COMMITTEE_IDS["community"])
SPIRIT = str(SEED_COMMITTEE_IDS["spirit"])


@pytest.fixture
def seeded(db_session):
    return seed_development_users(db_session)


def auth_header(make_token, user_id: uuid.UUID) -> dict[str, str]:
    return {"Authorization": f"Bearer {make_token(sub=user_id)}"}


def roster(client, make_token, user_key, seeded, ref=COMMUNITY):
    return client.get(
        f"/committees/{ref}/members", headers=auth_header(make_token, seeded[user_key].id)
    )


def test_a_head_reads_their_own_roster(client, make_token, seeded):
    response = roster(client, make_token, "community_head", seeded)

    assert response.status_code == 200, response.text
    members = response.json()["members"]
    assert members, "a seeded committee should not be empty"
    # Heads first, so the picker opens on the person most likely to be chosen.
    assert members[0]["isHead"] is True
    assert members[0]["position"] == "Head"


def test_a_plain_member_reads_the_roster_of_their_own_committee(client, make_token, seeded):
    """The picker would be empty for everyone else if this were denied."""
    response = roster(client, make_token, "community_member", seeded)

    assert response.status_code == 200, response.text
    ids = {m["id"] for m in response.json()["members"]}
    assert str(seeded["community_member"].id) in ids


def test_an_ordinary_membership_has_no_position_label(client, make_token, seeded):
    members = roster(client, make_token, "community_head", seeded).json()["members"]
    plain = [m for m in members if not m["isHead"]]
    assert plain, "expected at least one non-head"
    # "Member" under every name is noise, so it is absent rather than filler.
    assert all(m["position"] is None for m in plain)


def test_leadership_reads_any_roster(client, make_token, seeded):
    assert roster(client, make_token, "ac", seeded, ref=SPIRIT).status_code == 200


def test_asbo_reads_any_roster(client, make_token, seeded):
    """ASBO holds tasks.manage_all, so it can assign work anywhere.

    Note this passes through the API but would return nothing under RLS,
    where ASBO is denied users.view — see scripts/verify_board_rls.py.
    """
    assert roster(client, make_token, "asbo", seeded, ref=SPIRIT).status_code == 200


def test_a_camper_from_another_committee_is_refused(client, make_token, seeded):
    response = roster(client, make_token, "community_member", seeded, ref=SPIRIT)

    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "committee_scope_denied"


def test_the_slug_and_the_uuid_both_resolve(client, make_token, seeded):
    by_id = roster(client, make_token, "community_head", seeded, ref=COMMUNITY)
    by_slug = roster(client, make_token, "community_head", seeded, ref="community")

    assert by_slug.status_code == 200
    assert by_id.json() == by_slug.json()


def test_an_unknown_committee_is_not_found(client, make_token, seeded):
    response = roster(client, make_token, "ac", seeded, ref="no-such-committee")
    assert response.status_code == 404
