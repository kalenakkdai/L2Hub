"""L2 Board and cross-committee requests.

The workflow under test is the one the feature exists for: Community lists a
task, says it also needs Spirit, and Spirit finds a request waiting without
anyone having asked in a group chat.
"""

from __future__ import annotations

import uuid

import pytest
from sqlalchemy import select

from app.db.seed import SEED_COMMITTEE_IDS, seed_development_users
from app.models import Notification
from app.models.work import CommitteeRequest

COMMUNITY = str(SEED_COMMITTEE_IDS["community"])
SPIRIT = str(SEED_COMMITTEE_IDS["spirit"])


@pytest.fixture
def seeded(db_session):
    return seed_development_users(db_session)


def auth_header(make_token, user_id: uuid.UUID) -> dict[str, str]:
    return {"Authorization": f"Bearer {make_token(sub=user_id)}"}


def make_task(client, headers, **overrides) -> dict:
    body = {"committeeId": COMMUNITY, "title": "Run the winter fundraiser"}
    body.update(overrides)
    response = client.post("/board/tasks", json=body, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


def test_board_lists_every_committee_with_its_tasks(client, make_token, seeded):
    head = auth_header(make_token, seeded["community_head"].id)
    make_task(client, head, title="Book the venue")

    board = client.get("/board", headers=auth_header(make_token, seeded["ac"].id))
    assert board.status_code == 200

    # Keyed by id, not display name: committee names are editable content and
    # have already been renamed once underneath these tests.
    committees = {c["id"]: c for c in board.json()["committees"]}
    assert COMMUNITY in committees
    assert SPIRIT in committees
    assert [t["title"] for t in committees[COMMUNITY]["tasks"]] == ["Book the venue"]
    # Every committee appears, including the ones with nothing on them — an
    # empty column is information.
    assert committees[SPIRIT]["tasks"] == []
    # The twelve Leadership 2 committees from the roster catalog are all present.
    from app.db.l2_roster import L2_ROSTER_COMMITTEES

    slugs = {c["slug"] for c in board.json()["committees"]}
    assert {slug for slug, *_ in L2_ROSTER_COMMITTEES}.issubset(slugs)


def test_board_backfills_missing_roster_committees(client, make_token, seeded, db_session):
    """Opening the board creates any Leadership 2 columns a partial seed omitted."""
    from app.db.l2_roster import L2_ROSTER_COMMITTEES
    from app.models import Committee

    # Leave only the four committees the production screenshot showed.
    keep = {"activities", "community", "elections", "fundraising"}
    for committee in list(db_session.scalars(select(Committee)).all()):
        if committee.slug not in keep:
            db_session.delete(committee)
    db_session.commit()

    board = client.get("/board", headers=auth_header(make_token, seeded["ac"].id))
    assert board.status_code == 200
    slugs = {c["slug"] for c in board.json()["committees"]}
    assert {slug for slug, *_ in L2_ROSTER_COMMITTEES}.issubset(slugs)
    assert {"Campus", "Publicity", "Tech", "Videography/Photography"}.issubset(
        {c["name"] for c in board.json()["committees"]}
    )

def test_the_whole_class_can_open_the_board(client, make_token, seeded):
    """Reading the board is not a privilege — it is the point of the board."""
    for role in ("community_member", "community_head", "senior_class_officer", "ac"):
        headers = auth_header(make_token, seeded[role].id)
        assert client.get("/board", headers=headers).status_code == 200, role


def test_board_marks_which_committees_the_caller_may_write(client, make_token, seeded):
    board = client.get(
        "/board", headers=auth_header(make_token, seeded["community_head"].id)
    ).json()
    writable = {c["id"]: c["canAddTask"] for c in board["committees"]}
    # A head sees every column but only adds work to their own.
    assert writable[COMMUNITY] is True
    assert writable[SPIRIT] is False


# ---------------------------------------------------------------------------
# Tasks
# ---------------------------------------------------------------------------


def test_assigning_a_task_notifies_the_assignee(client, make_token, seeded, db_session):
    head = auth_header(make_token, seeded["community_head"].id)
    make_task(client, head, assigneeUserId=str(seeded["community_member"].id))

    notes = db_session.scalars(
        select(Notification).where(
            Notification.recipient_user_id == seeded["community_member"].id
        )
    ).all()
    assert [n.type for n in notes] == ["task.assigned"]


def test_a_task_cannot_be_assigned_outside_its_committee(client, make_token, seeded):
    head = auth_header(make_token, seeded["community_head"].id)
    response = client.post(
        "/board/tasks",
        json={
            "committeeId": COMMUNITY,
            "title": "Book the venue",
            "assigneeUserId": str(seeded["spirit_member"].id),
        },
        headers=head,
    )
    assert response.status_code == 400


def test_a_head_cannot_add_tasks_to_another_committee(client, make_token, seeded):
    head = auth_header(make_token, seeded["community_head"].id)
    response = client.post(
        "/board/tasks",
        json={"committeeId": SPIRIT, "title": "Not mine to give"},
        headers=head,
    )
    assert response.status_code == 403


def test_task_status_moves(client, make_token, seeded):
    head = auth_header(make_token, seeded["community_head"].id)
    task = make_task(client, head)["task"]

    response = client.patch(
        f"/board/tasks/{task['id']}", json={"status": "done"}, headers=head
    )
    assert response.status_code == 200
    assert response.json()["task"]["status"] == "done"


def test_unknown_task_status_is_refused(client, make_token, seeded):
    head = auth_header(make_token, seeded["community_head"].id)
    task = make_task(client, head)["task"]
    response = client.patch(
        f"/board/tasks/{task['id']}", json={"status": "shipped"}, headers=head
    )
    assert response.status_code == 400


# ---------------------------------------------------------------------------
# The fan-out — the reason the feature exists
# ---------------------------------------------------------------------------


def test_listing_a_task_fans_out_requests_to_the_committees_it_needs(
    client, make_token, seeded, db_session
):
    head = auth_header(make_token, seeded["community_head"].id)
    created = make_task(
        client, head, title="Winter fundraiser", collaboratorCommitteeIds=[SPIRIT]
    )

    assert len(created["requests"]) == 1
    request = created["requests"][0]
    assert request["requestingCommittee"]["id"] == COMMUNITY
    assert request["targetCommittee"]["id"] == SPIRIT
    assert request["status"] == "open"
    # The trail back to the task is what makes this readable months later.
    assert request["sourceTaskId"] == created["task"]["id"]

    # Publicity (Spirit in seed fixtures) also gets a real board row, not only
    # a request in the log — that is what "show on their board" means.
    board = client.get("/board", headers=auth_header(make_token, seeded["ac"].id)).json()
    spirit_column = next(c for c in board["committees"] if c["id"] == SPIRIT)
    mirrored = [t for t in spirit_column["tasks"] if t["title"] == "Winter fundraiser"]
    assert len(mirrored) == 1
    assert mirrored[0]["originTaskId"] == created["task"]["id"]
    assert mirrored[0]["fromCommittee"]["id"] == COMMUNITY

    # Spirit's whole crew + ASBO hear about it — not just the head.
    spirit_notes = db_session.scalars(
        select(Notification).where(
            Notification.recipient_user_id == seeded["spirit_head"].id
        )
    ).all()
    assert [n.type for n in spirit_notes] == ["request.received"]
    assert "requested Winter fundraiser" in spirit_notes[0].title

    member_notes = db_session.scalars(
        select(Notification).where(
            Notification.recipient_user_id == seeded["spirit_member"].id
        )
    ).all()
    assert [n.type for n in member_notes] == ["request.received"]

    community_member_notes = db_session.scalars(
        select(Notification).where(
            Notification.recipient_user_id == seeded["community_member"].id
        )
    ).all()
    assert [n.type for n in community_member_notes] == ["request.received"]

    asbo_notes = db_session.scalars(
        select(Notification).where(
            Notification.recipient_user_id == seeded["asbo"].id
        )
    ).all()
    assert [n.type for n in asbo_notes] == ["request.received"]


def test_fan_out_ignores_the_owning_committee_and_duplicates(
    client, make_token, seeded
):
    head = auth_header(make_token, seeded["community_head"].id)
    created = make_task(
        client, head, collaboratorCommitteeIds=[SPIRIT, SPIRIT, COMMUNITY]
    )
    # Asking yourself is the task itself; asking twice is still one request.
    assert len(created["requests"]) == 1

    board = client.get("/board", headers=auth_header(make_token, seeded["ac"].id)).json()
    community = next(c for c in board["committees"] if c["id"] == COMMUNITY)
    # Origin only — no self-mirror.
    assert len([t for t in community["tasks"] if t.get("originTaskId")]) == 0


def test_task_can_link_to_an_event_and_mirrors_carry_it(
    client, make_token, seeded
):
    from app.db.seed import SEED_EVENT_IDS

    maze = str(SEED_EVENT_IDS["maze_2026"])
    head = auth_header(make_token, seeded["community_head"].id)
    created = make_task(
        client,
        head,
        title="Maze Day flyer",
        eventId=maze,
        collaboratorCommitteeIds=[SPIRIT],
    )
    assert created["task"]["event"]["id"] == maze
    assert created["task"]["event"]["name"] == "Maze Day"

    board = client.get("/board", headers=auth_header(make_token, seeded["ac"].id)).json()
    spirit = next(c for c in board["committees"] if c["id"] == SPIRIT)
    mirror = next(t for t in spirit["tasks"] if t["title"] == "Maze Day flyer")
    assert mirror["event"]["id"] == maze
    assert mirror["fromCommittee"]["id"] == COMMUNITY


def test_calendar_only_events_cannot_be_linked_to_tasks(
    client, make_token, seeded, db_session
):
    from app.models.event_summary import Event

    calendar = Event(
        name="Soccer",
        slug="soccer-calendar-only",
        year=2026,
        status="calendar",
    )
    db_session.add(calendar)
    db_session.commit()

    head = auth_header(make_token, seeded["community_head"].id)
    response = client.post(
        "/board/tasks",
        json={
            "committeeId": COMMUNITY,
            "title": "Not a board event",
            "eventId": str(calendar.id),
        },
        headers=head,
    )
    assert response.status_code == 400
    assert "Calendar-only" in response.json()["detail"]


# ---------------------------------------------------------------------------
# Requests
# ---------------------------------------------------------------------------


def test_member_files_a_request_for_their_own_committee(client, make_token, seeded):
    member = auth_header(make_token, seeded["community_member"].id)
    response = client.post(
        "/requests",
        json={
            "requestingCommitteeId": COMMUNITY,
            "targetCommitteeId": SPIRIT,
            "title": "Need a post for the fundraiser",
        },
        headers=member,
    )
    assert response.status_code == 201
    assert response.json()["request"]["status"] == "open"


def test_member_cannot_file_in_another_committees_name(client, make_token, seeded):
    member = auth_header(make_token, seeded["community_member"].id)
    response = client.post(
        "/requests",
        json={
            "requestingCommitteeId": SPIRIT,
            "targetCommitteeId": COMMUNITY,
            "title": "Speaking for people I am not with",
        },
        headers=member,
    )
    assert response.status_code == 403


def test_a_committee_cannot_request_from_itself(client, make_token, seeded):
    head = auth_header(make_token, seeded["community_head"].id)
    response = client.post(
        "/requests",
        json={
            "requestingCommitteeId": COMMUNITY,
            "targetCommitteeId": COMMUNITY,
            "title": "Circular",
        },
        headers=head,
    )
    assert response.status_code == 400


def test_everyone_can_read_the_cross_org_log(client, make_token, seeded):
    """The trail is only useful if the people doing the work can read it."""
    for role in (
        "community_member",
        "community_head",
        "senior_class_officer",
        "asbo",
        "ac",
    ):
        headers = auth_header(make_token, seeded[role].id)
        assert client.get("/requests", headers=headers).status_code == 200, role


def test_members_see_their_own_committees_traffic(client, make_token, seeded):
    community = auth_header(make_token, seeded["community_member"].id)
    client.post(
        "/requests",
        json={
            "requestingCommitteeId": COMMUNITY,
            "targetCommitteeId": SPIRIT,
            "title": "Need a post",
        },
        headers=community,
    )

    mine = client.get("/requests/mine", headers=community).json()
    assert [r["title"] for r in mine["outbound"]] == ["Need a post"]
    assert mine["inbound"] == []

    theirs = client.get(
        "/requests/mine", headers=auth_header(make_token, seeded["spirit_member"].id)
    ).json()
    assert [r["title"] for r in theirs["inbound"]] == ["Need a post"]
    assert theirs["outbound"] == []


def test_the_asked_committee_answers_and_the_asker_hears(
    client, make_token, seeded, db_session
):
    community = auth_header(make_token, seeded["community_member"].id)
    created = client.post(
        "/requests",
        json={
            "requestingCommitteeId": COMMUNITY,
            "targetCommitteeId": SPIRIT,
            "title": "Need a post",
        },
        headers=community,
    ).json()["request"]

    spirit = auth_header(make_token, seeded["spirit_member"].id)
    response = client.post(
        f"/requests/{created['id']}/respond", json={"status": "accepted"}, headers=spirit
    )
    assert response.status_code == 200
    assert response.json()["request"]["status"] == "accepted"
    assert response.json()["request"]["respondedBy"]["name"] == "Sam Ortiz"

    # Community's head is told, because Community is who asked.
    types = [
        n.type
        for n in db_session.scalars(
            select(Notification).where(
                Notification.recipient_user_id == seeded["community_head"].id
            )
        ).all()
    ]
    assert "request.accepted" in types


def test_the_asking_committee_cannot_answer_for_the_other_side(
    client, make_token, seeded
):
    community = auth_header(make_token, seeded["community_member"].id)
    created = client.post(
        "/requests",
        json={
            "requestingCommitteeId": COMMUNITY,
            "targetCommitteeId": SPIRIT,
            "title": "Need a post",
        },
        headers=community,
    ).json()["request"]

    response = client.post(
        f"/requests/{created['id']}/respond",
        json={"status": "done"},
        headers=community,
    )
    assert response.status_code == 403


def test_a_head_cannot_answer_another_committees_request(client, make_token, seeded):
    """Seeing every request is not the same as speaking for every committee."""
    community_head = auth_header(make_token, seeded["community_head"].id)
    created = client.post(
        "/requests",
        json={
            "requestingCommitteeId": COMMUNITY,
            "targetCommitteeId": SPIRIT,
            "title": "Need a post",
        },
        headers=community_head,
    ).json()["request"]

    # Community's head can read this on /requests, but Spirit answers it.
    assert client.get("/requests", headers=community_head).status_code == 200
    response = client.post(
        f"/requests/{created['id']}/respond",
        json={"status": "done"},
        headers=community_head,
    )
    assert response.status_code == 403


def test_platform_ops_can_unstick_any_request(client, make_token, seeded):
    community = auth_header(make_token, seeded["community_member"].id)
    created = client.post(
        "/requests",
        json={
            "requestingCommitteeId": COMMUNITY,
            "targetCommitteeId": SPIRIT,
            "title": "Need a post",
        },
        headers=community,
    ).json()["request"]

    ac = auth_header(make_token, seeded["ac"].id)
    response = client.post(
        f"/requests/{created['id']}/respond", json={"status": "done"}, headers=ac
    )
    assert response.status_code == 200


def test_declining_is_recorded_rather_than_left_open(
    client, make_token, seeded, db_session
):
    community = auth_header(make_token, seeded["community_member"].id)
    created = client.post(
        "/requests",
        json={
            "requestingCommitteeId": COMMUNITY,
            "targetCommitteeId": SPIRIT,
            "title": "Need a post",
        },
        headers=community,
    ).json()["request"]

    spirit = auth_header(make_token, seeded["spirit_member"].id)
    client.post(
        f"/requests/{created['id']}/respond", json={"status": "declined"}, headers=spirit
    )

    stored = db_session.get(CommitteeRequest, uuid.UUID(created["id"]))
    assert stored.status == "declined"
    assert stored.responded_at is not None


# ---------------------------------------------------------------------------
# Assignment rules
# ---------------------------------------------------------------------------


def test_a_task_cannot_be_reassigned_outside_its_committee(
    client, make_token, seeded, db_session
):
    """create_task has always checked this; update_task used to not.

    Listing a task unassigned and then patching an outsider onto it walked
    straight around the rule, and told them about work on a board they
    cannot even see.
    """
    head = auth_header(make_token, seeded["community_head"].id)
    task = make_task(client, head)["task"]

    response = client.patch(
        f"/board/tasks/{task['id']}",
        json={"assigneeUserId": str(seeded["spirit_member"].id)},
        headers=head,
    )

    assert response.status_code == 400
    assert "not in this committee" in response.text
    notes = db_session.scalars(
        select(Notification).where(
            Notification.recipient_user_id == seeded["spirit_member"].id
        )
    ).all()
    assert list(notes) == []


def test_the_add_task_flag_agrees_with_the_write_path(client, make_token, seeded):
    """A button that 403s is worse than no button.

    canAddTask used to be plain membership while the write additionally
    required headship, so every plain member was offered "Add task" on their
    own committee and refused when they used it.
    """
    for user_key in ("community_member", "community_head", "asbo"):
        headers = auth_header(make_token, seeded[user_key].id)
        board = client.get("/board", headers=headers).json()

        for column in board["committees"]:
            response = client.post(
                "/board/tasks",
                json={"committeeId": column["id"], "title": "Probe"},
                headers=headers,
            )
            expected = 201 if column["canAddTask"] else 403
            assert response.status_code == expected, (
                f"{user_key} on {column['name']}: canAddTask="
                f"{column['canAddTask']} but POST returned {response.status_code}"
            )
