"""Event Summary workflow integration tests."""

from __future__ import annotations

import uuid

import pytest

from app.db.seed import SEED_EVENT_IDS, seed_development_users


@pytest.fixture
def seeded(db_session):
    return seed_development_users(db_session)


def auth_header(make_token, user_id: uuid.UUID) -> dict[str, str]:
    return {"Authorization": f"Bearer {make_token(sub=user_id)}"}


def test_asbo_requests_and_president_approves(client, make_token, seeded):
    event_id = SEED_EVENT_IDS["maze_2026"]
    asbo_headers = auth_header(make_token, seeded["asbo"].id)
    request = client.post(
        f"/events/{event_id}/summary/request",
        headers=asbo_headers,
        json={"note": "Ready for Wrapped"},
    )
    assert request.status_code == 200
    assert request.json()["status"] == "pending"

    # ASBO cannot approve
    denied = client.post(
        f"/events/{event_id}/summary/approve",
        headers=asbo_headers,
    )
    assert denied.status_code == 403

    president_headers = auth_header(make_token, seeded["president"].id)
    approved = client.post(
        f"/events/{event_id}/summary/approve",
        headers=president_headers,
    )
    assert approved.status_code == 200
    assert approved.json()["status"] == "generated"

    published = client.post(
        f"/events/{event_id}/summary/publish",
        headers=president_headers,
    )
    assert published.status_code == 200
    assert published.json()["status"] == "published"


def test_committee_head_cannot_request_other_committee_event(
    client, make_token, seeded, db_session
):
    from app.models import Event

    # Attach maze day to community; spirit head should be denied.
    event = db_session.get(Event, SEED_EVENT_IDS["maze_2026"])
    assert event is not None
    headers = auth_header(make_token, seeded["spirit_head"].id)
    response = client.post(f"/events/{event.slug}/summary/request", headers=headers)
    assert response.status_code == 403


def test_community_head_can_request_own_event(client, make_token, seeded):
    headers = auth_header(make_token, seeded["community_head"].id)
    response = client.post(
        "/events/maze-day-2026/summary/request",
        headers=headers,
    )
    assert response.status_code == 200


def test_member_can_view_published_only(client, make_token, seeded):
    event_id = SEED_EVENT_IDS["maze_2026"]
    president_headers = auth_header(make_token, seeded["president"].id)
    client.post(f"/events/{event_id}/summary/generate", headers=president_headers)

    member_headers = auth_header(make_token, seeded["community_member"].id)
    draft = client.get(f"/events/{event_id}/wrapped", headers=member_headers)
    assert draft.status_code == 403

    client.post(f"/events/{event_id}/summary/publish", headers=president_headers)
    published = client.get(f"/events/{event_id}/wrapped", headers=member_headers)
    assert published.status_code == 200
    graph = published.json()["graph"]
    anonymous_quotes = [
        c
        for theme in graph["themes"]
        for c in theme.get("contributors", [])
        if c.get("anonymous")
    ]
    assert anonymous_quotes
    for quote in anonymous_quotes:
        assert quote.get("name") is None


def test_asbo_cannot_edit_grades_endpoint_still_views(client, make_token, seeded):
    headers = auth_header(make_token, seeded["asbo"].id)
    assert client.get("/grades/all", headers=headers).status_code == 200
    assert client.get("/feedback/private", headers=headers).status_code == 403


def test_every_theme_quotes_match_its_mention_count():
    from app.services.event_summary.deterministic import DeterministicEventSummaryProvider

    payload = DeterministicEventSummaryProvider().build_payload(
        event_name="Maze Day", event_year=2026
    )
    themes = payload["graph"]["themes"]
    assert themes

    for theme in themes:
        quotes = theme["contributors"]
        assert theme["mentions"] == len(quotes), theme["id"]
        # Repeating one quote verbatim would read as a bug, not as feedback.
        assert len({q["quote"] for q in quotes}) == len(quotes), theme["id"]

        named = [q["name"] for q in quotes if not q["anonymous"]]
        assert len(named) == len(set(named)), theme["id"]

        for quote in quotes:
            if quote["anonymous"]:
                assert quote["name"] is None
                assert quote["committee"] is None


def test_graph_node_mentions_match_theme_quote_counts():
    from app.services.event_summary.deterministic import DeterministicEventSummaryProvider

    graph = DeterministicEventSummaryProvider().build_payload(
        event_name="Maze Day", event_year=2026
    )["graph"]
    quote_counts = {t["id"]: len(t["contributors"]) for t in graph["themes"]}

    for node in graph["nodes"]:
        assert node["mentions"] == quote_counts[node["id"]]


def test_notifications_created_for_superadmins(client, make_token, seeded):
    headers = auth_header(make_token, seeded["asbo"].id)
    client.post("/events/maze-day-2026/summary/request", headers=headers)
    ac_headers = auth_header(make_token, seeded["ac"].id)
    notes = client.get("/notifications", headers=ac_headers)
    assert notes.status_code == 200
    assert any(n["type"] == "wrapped.request" for n in notes.json()["notifications"])
