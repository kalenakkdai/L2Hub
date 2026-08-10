"""Messenger Agenda: keywords, agenda generation, permissions, and API flow."""

from __future__ import annotations

import pytest

from app.core import permission_keys as pk
from app.db.seed import seed_development_users
from app.services import authorization as authz
from app.services.messenger_agenda.agenda import generate_agenda
from app.services.messenger_agenda.assignments import generate_assignment_drafts
from app.services.messenger_agenda.keywords import extract_capture_window


@pytest.fixture
def seeded(db_session):
    return seed_development_users(db_session)


def auth_header(make_token, user_id) -> dict[str, str]:
    return {"Authorization": f"Bearer {make_token(sub=user_id)}"}


CHAT = """\
Kalena: hey everyone
Jan: agenda start
Jordan: Winter Ball goals — lock venue and publicity cadence
Sam: Events will handle check-in stations
Avery: Publicity should post the flyer by Friday
Jan: agreed we will approve the budget tomorrow
Jordan: agenda end
Kalena: see you thursday
"""


def test_extract_capture_window_between_keywords():
    captured, saw_start, saw_end = extract_capture_window(CHAT)
    assert saw_start and saw_end
    assert "Winter Ball goals" in captured
    assert "hey everyone" not in captured
    assert "see you thursday" not in captured


def test_extract_while_capturing_includes_pre_keyword_after_button():
    text = "Early note about balloons\nagenda start\nDecide on theme\nagenda end"
    captured, saw_start, saw_end = extract_capture_window(text, capturing=True)
    assert saw_start and saw_end
    assert "Early note about balloons" in captured
    assert "Decide on theme" in captured


def test_generate_agenda_has_action_and_decision_sections():
    agenda = generate_agenda(
        session_title="Cabinet chat",
        captured_text=(
            "We decided to approve the budget. "
            "Publicity will create the flyer. "
            "Who is attending?"
        ),
    )
    assert agenda.title == "Cabinet chat"
    titles = {s.title for s in agenda.sections}
    assert "Action items" in titles
    assert "Key decisions" in titles
    actions = next(s for s in agenda.sections if s.title == "Action items")
    assert any("flyer" in b.lower() for b in actions.bullets)


def test_assignment_drafts_map_committees():
    drafts = generate_assignment_drafts(
        [
            "Publicity should post the flyer by Friday",
            "Events will handle check-in stations",
            "Spirit needs a new chant",
        ]
    )
    slugs = {d.committee_slug for d in drafts}
    assert "publicity" in slugs
    assert "events" in slugs
    assert "spirit" in slugs


def test_member_can_run_keyword_to_agenda_flow(client, make_token, seeded):
    headers = auth_header(make_token, seeded["community_member"].id)
    created = client.post(
        "/messenger-agenda/sessions",
        headers=headers,
        json={"title": "ASB chat", "source": "messenger"},
    )
    assert created.status_code == 201
    session_id = created.json()["id"]

    assert (
        client.post(
            f"/messenger-agenda/sessions/{session_id}/start", headers=headers
        ).status_code
        == 200
    )

    ingested = client.post(
        f"/messenger-agenda/sessions/{session_id}/ingest",
        headers=headers,
        json={"rawText": CHAT},
    )
    assert ingested.status_code == 200
    body = ingested.json()
    # End keyword auto-finalizes.
    assert body["status"] == "finalized"
    assert body["agenda"]["title"]
    assert body["assignments"]

    regenerated = client.post(
        f"/messenger-agenda/sessions/{session_id}/assignments/generate",
        headers=headers,
    )
    assert regenerated.status_code == 200
    assert len(regenerated.json()["assignments"]) >= 1


def test_member_can_connect_messenger_and_list_threads(client, make_token, seeded):
    headers = auth_header(make_token, seeded["community_member"].id)
    before = client.get("/messenger-agenda/connection", headers=headers)
    assert before.status_code == 200
    assert before.json()["status"] == "disconnected"

    connected = client.post(
        "/messenger-agenda/connection/connect",
        headers=headers,
        json={"grantedThreadIds": ["thread-asb-cabinet"]},
    )
    assert connected.status_code == 200
    assert connected.json()["status"] == "connected"
    assert len(connected.json()["grantedThreads"]) == 1


def test_member_permissions_include_messenger_agenda(db_session, seeded):
    member = seeded["community_member"]
    assert authz.has_permission(db_session, member, pk.MESSENGER_AGENDA_VIEW)
    assert authz.has_permission(db_session, member, pk.MESSENGER_AGENDA_INGEST)
    assert not authz.has_permission(db_session, member, pk.MESSENGER_AGENDA_MANAGE)
