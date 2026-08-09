import json
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime

import pytest

from app.core import permission_keys as pk
from app.core.role_catalog import ROLE_PERMISSION_BUNDLES
from app.models.event_summary import Event
from app.models.note_taker import MeetingNote, MeetingSession, MeetingTranscript
from app.services.note_taker import service as note_taker
from app.services.note_taker.naming import suggest_meeting_title
from app.services.note_taker.notes import generate_meeting_note
from app.services.note_taker.whisper import (
    TranscriptResult,
    TranscriptSegment,
    set_transcriber,
)
from app.storage.local import LocalFolderStorage


def test_member_bundle_includes_note_taker_view_and_record():
    bundle = ROLE_PERMISSION_BUNDLES["member"]
    assert pk.NOTE_TAKER_VIEW in bundle
    assert pk.NOTE_TAKER_RECORD in bundle
    assert pk.NOTE_TAKER_MANAGE not in bundle


def test_class_advisor_does_not_get_note_taker():
    bundle = ROLE_PERMISSION_BUNDLES["class_advisor"]
    assert pk.NOTE_TAKER_VIEW not in bundle
    assert pk.NOTE_TAKER_RECORD not in bundle


def test_asbo_receives_note_taker_manage():
    assert pk.NOTE_TAKER_MANAGE in ROLE_PERMISSION_BUNDLES["asbo"]
    assert pk.NOTE_TAKER_MANAGE in ROLE_PERMISSION_BUNDLES["ac"]


def test_generate_meeting_note_extracts_decisions_actions_and_questions():
    transcript = (
        "Welcome to the meeting. We decided to lock the theme. "
        "Jordan will send the flyer by Friday. "
        "Should we book the gym? "
        "We agreed on a $200 budget."
    )
    note = generate_meeting_note(session_title="Maze sync", transcript=transcript)
    assert note.title == "Maze sync"
    assert "theme" in note.summary.lower() or "Welcome" in note.summary
    titles = {section.title: section.bullets for section in note.sections}
    assert any("decided" in bullet.lower() for bullet in titles["Key decisions"])
    assert any("will send" in bullet.lower() for bullet in titles["Action items"])
    assert any("?" in bullet for bullet in titles["Open questions"])


def test_suggest_meeting_title_uses_event_and_sequence():
    when = datetime(2026, 8, 8, tzinfo=UTC)
    assert (
        suggest_meeting_title(event_name="Maze Day 2026", sequence=3, when=when)
        == "Maze Day 2026 · Meeting 3 · 8.8.2026"
    )


def test_suggest_meeting_title_falls_back_without_an_event():
    when = datetime(2026, 1, 5, tzinfo=UTC)
    assert (
        suggest_meeting_title(event_name=None, sequence=1, when=when)
        == "Leadership meeting 1 · 1.5.2026"
    )
    # A zero or negative sequence still reads as the first meeting.
    assert (
        suggest_meeting_title(event_name="   ", sequence=0, when=when)
        == "Leadership meeting 1 · 1.5.2026"
    )


@pytest.fixture
def maze_event(db_session):
    event = Event(
        id=uuid.uuid4(),
        name="Maze Day",
        slug=f"maze-day-{uuid.uuid4().hex[:6]}",
        year=2026,
        status="scheduled",
    )
    db_session.add(event)
    db_session.commit()
    return event


def test_blank_title_is_auto_generated_and_counts_up_per_event(
    db_session, make_profile, maze_event
):
    profile = make_profile(email="auto@example.edu")

    first = note_taker.create_session(db_session, profile, event_id=maze_event.id)
    second = note_taker.create_session(
        db_session, profile, title="   ", event_id=maze_event.id
    )

    assert first.title.startswith("Maze Day 2026 · Meeting 1 · ")
    assert second.title.startswith("Maze Day 2026 · Meeting 2 · ")


def test_sessions_can_be_listed_and_renamed_per_event(
    db_session, make_profile, make_token, client, maze_event
):
    profile = make_profile(email="timeline@example.edu")
    token = make_token(sub=profile.id)
    headers = {"Authorization": f"Bearer {token}"}

    linked = client.post(
        "/note-taker/sessions", headers=headers, json={"eventId": str(maze_event.id)}
    )
    assert linked.status_code == 201
    assert linked.json()["eventId"] == str(maze_event.id)
    assert linked.json()["title"].startswith("Maze Day 2026 · Meeting 1 · ")

    client.post("/note-taker/sessions", headers=headers, json={"title": "Unlinked"})

    scoped = client.get(
        f"/note-taker/sessions?eventId={maze_event.id}", headers=headers
    )
    assert scoped.status_code == 200
    assert [item["id"] for item in scoped.json()["sessions"]] == [linked.json()["id"]]

    renamed = client.patch(
        f"/note-taker/sessions/{linked.json()['id']}",
        headers=headers,
        json={"title": "  Maze Day kickoff  "},
    )
    assert renamed.status_code == 200
    assert renamed.json()["title"] == "Maze Day kickoff"

    assert (
        client.patch(
            f"/note-taker/sessions/{linked.json()['id']}",
            headers=headers,
            json={"title": "   "},
        ).status_code
        == 400
    )


def test_suggested_title_endpoint_previews_the_next_name(
    make_profile, make_token, client, maze_event
):
    profile = make_profile(email="preview@example.edu")
    headers = {"Authorization": f"Bearer {make_token(sub=profile.id)}"}
    response = client.get(
        f"/note-taker/suggested-title?eventId={maze_event.id}", headers=headers
    )
    assert response.status_code == 200
    assert response.json()["title"].startswith("Maze Day 2026 · Meeting 1 · ")


def test_member_cannot_rename_another_members_meeting(
    make_profile, make_token, client
):
    owner = make_profile(email="own@example.edu")
    intruder = make_profile(email="nope@example.edu")
    created = client.post(
        "/note-taker/sessions",
        headers={"Authorization": f"Bearer {make_token(sub=owner.id)}"},
        json={"title": "Owned"},
    )
    denied = client.patch(
        f"/note-taker/sessions/{created.json()['id']}",
        headers={"Authorization": f"Bearer {make_token(sub=intruder.id)}"},
        json={"title": "Hijacked"},
    )
    assert denied.status_code == 403


@dataclass
class FakeTranscriber:
    text: str = "Hello. We decided to ship Friday. Alex will update the roster."

    def transcribe(self, audio_bytes: bytes, *, content_type: str | None = None) -> TranscriptResult:
        assert audio_bytes
        return TranscriptResult(
            full_text=self.text,
            segments=(
                TranscriptSegment(start_ms=0, end_ms=1200, text="Hello."),
                TranscriptSegment(
                    start_ms=1200, end_ms=4000, text="We decided to ship Friday."
                ),
            ),
            language="en",
            provider="whisper-local",
        )


@pytest.fixture
def storage(tmp_path):
    return LocalFolderStorage(tmp_path / "note-taker-store")


@pytest.fixture(autouse=True)
def _mock_whisper():
    set_transcriber(FakeTranscriber())
    yield
    set_transcriber(None)


def test_browser_transcript_skips_whisper(
    db_session, make_profile, storage, make_token, client
):
    class MustNotRun:
        def transcribe(self, audio_bytes: bytes, *, content_type: str | None = None):
            raise AssertionError("Whisper should not run when Chrome transcript is present")

    set_transcriber(MustNotRun())
    profile = make_profile(email="chrome@example.edu")
    token = make_token(sub=profile.id)

    created = client.post(
        "/note-taker/sessions",
        headers={"Authorization": f"Bearer {token}"},
        json={"title": "Chrome sync"},
    )
    session_id = created.json()["id"]

    session = note_taker.store_audio_and_queue(
        db_session,
        profile,
        storage,
        uuid.UUID(session_id),
        audio_bytes=b"fake-webm-bytes",
        content_type="audio/webm",
        duration_ms=4200,
        transcript_full_text="We decided to order pizza. Jordan will email parents.",
        transcript_segments_json=json.dumps(
            [
                {"startMs": 0, "endMs": 1800, "text": "We decided to order pizza."},
                {"startMs": 1800, "endMs": 4000, "text": "Jordan will email parents."},
            ]
        ),
        transcript_language="en-US",
        transcript_provider="chrome-web-speech",
    )
    assert session.status == "processing"

    ready = note_taker.process_session(db_session, storage, uuid.UUID(session_id))
    assert ready.status == "ready"

    transcript = db_session.get(MeetingTranscript, uuid.UUID(session_id))
    note = db_session.get(MeetingNote, uuid.UUID(session_id))
    assert transcript is not None
    assert transcript.provider == "chrome-web-speech"
    assert "pizza" in transcript.full_text.lower()
    assert note is not None
    assert note.title == "Chrome sync"


def test_upload_stores_opaque_key_and_processing_creates_transcript_and_note(
    db_session, make_profile, storage, make_token, client
):
    profile = make_profile(email="noter@example.edu")
    token = make_token(sub=profile.id)

    created = client.post(
        "/note-taker/sessions",
        headers={"Authorization": f"Bearer {token}"},
        json={"title": "Committee sync"},
    )
    assert created.status_code == 201
    session_id = created.json()["id"]

    # Use the service with the temp storage so we do not depend on the process
    # singleton path for the opaque-key assertion.
    session = note_taker.store_audio_and_queue(
        db_session,
        profile,
        storage,
        uuid.UUID(session_id),
        audio_bytes=b"fake-webm-bytes",
        content_type="audio/webm",
        duration_ms=3500,
    )
    assert session.status == "processing"
    assert session.audio_storage_key is not None
    assert session.audio_storage_key.startswith("note-taker/")
    assert "recording" not in session.audio_storage_key
    assert storage.exists(session.audio_storage_key)

    ready = note_taker.process_session(db_session, storage, uuid.UUID(session_id))
    assert ready.status == "ready"

    transcript = db_session.get(MeetingTranscript, uuid.UUID(session_id))
    note = db_session.get(MeetingNote, uuid.UUID(session_id))
    assert transcript is not None
    assert "decided" in transcript.full_text.lower()
    assert note is not None
    assert note.title == "Committee sync"

    detail = client.get(
        f"/note-taker/sessions/{session_id}/transcript",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert detail.status_code == 200
    assert detail.json()["fullText"]
    assert len(detail.json()["segments"]) == 2

    note_resp = client.get(
        f"/note-taker/sessions/{session_id}/note",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert note_resp.status_code == 200
    assert note_resp.json()["sections"]


def test_member_cannot_read_another_users_session(
    db_session, make_profile, storage, make_token, client
):
    owner = make_profile(email="owner@example.edu")
    other = make_profile(email="other@example.edu")
    owner_token = make_token(sub=owner.id)
    other_token = make_token(sub=other.id)

    created = client.post(
        "/note-taker/sessions",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={"title": "Private meeting"},
    )
    session_id = created.json()["id"]

    denied = client.get(
        f"/note-taker/sessions/{session_id}",
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert denied.status_code == 403


def test_failed_whisper_marks_session_failed(db_session, make_profile, storage):
    class Boom:
        def transcribe(self, audio_bytes: bytes, *, content_type: str | None = None):
            raise RuntimeError("whisper exploded")

    set_transcriber(Boom())
    profile = make_profile(email="boom@example.edu")
    session = note_taker.create_session(db_session, profile, title="Will fail")
    note_taker.store_audio_and_queue(
        db_session,
        profile,
        storage,
        session.id,
        audio_bytes=b"x",
        content_type="audio/webm",
        duration_ms=100,
    )
    with pytest.raises(RuntimeError):
        note_taker.process_session(db_session, storage, session.id)

    refreshed = db_session.get(MeetingSession, session.id)
    assert refreshed is not None
    assert refreshed.status == "failed"
    assert refreshed.error_message


def test_audio_endpoint_returns_bytes(
    db_session, make_profile, make_token, client, tmp_path
):
    from app.api.deps import get_storage
    from app.main import app as fastapi_app
    from app.storage.factory import reset_storage_singleton

    store = LocalFolderStorage(tmp_path / "audio-dl")
    fastapi_app.dependency_overrides[get_storage] = lambda: store

    profile = make_profile(email="audio@example.edu")
    token = make_token(sub=profile.id)
    created = client.post(
        "/note-taker/sessions",
        headers={"Authorization": f"Bearer {token}"},
        json={"title": "Audio check"},
    )
    session_id = uuid.UUID(created.json()["id"])
    note_taker.store_audio_and_queue(
        db_session,
        profile,
        store,
        session_id,
        audio_bytes=b"abc123audio",
        content_type="audio/webm",
        duration_ms=500,
    )
    note_taker.process_session(db_session, store, session_id)

    response = client.get(
        f"/note-taker/sessions/{session_id}/audio",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert response.content == b"abc123audio"
    assert "audio" in response.headers["content-type"]
    reset_storage_singleton()


def test_log_can_be_linked_to_many_event_fires(
    db_session, make_profile, make_token, client, maze_event
):
    profile = make_profile(email="logs@example.edu")
    headers = {"Authorization": f"Bearer {make_token(sub=profile.id)}"}
    other = Event(
        id=uuid.uuid4(),
        name="Winter Rally",
        slug=f"winter-rally-{uuid.uuid4().hex[:8]}",
        year=2026,
        status="scheduled",
    )
    db_session.add(other)
    db_session.commit()

    created = client.post(
        "/note-taker/sessions",
        headers=headers,
        json={"title": "Shared shopping list"},
    )
    session_id = created.json()["id"]
    assert created.json()["eventIds"] == []

    first = client.post(
        f"/note-taker/sessions/{session_id}/events/{maze_event.id}",
        headers=headers,
    )
    assert first.status_code == 200
    assert str(maze_event.id) in first.json()["eventIds"]

    # Idempotent: linking again is not an error.
    again = client.post(
        f"/note-taker/sessions/{session_id}/events/{maze_event.id}",
        headers=headers,
    )
    assert again.status_code == 200
    assert again.json()["eventIds"].count(str(maze_event.id)) == 1

    second = client.post(
        f"/note-taker/sessions/{session_id}/events/{other.id}",
        headers=headers,
    )
    assert second.status_code == 200
    assert set(second.json()["eventIds"]) == {str(maze_event.id), str(other.id)}

    maze_list = client.get(
        f"/note-taker/sessions?eventId={maze_event.id}", headers=headers
    )
    rally_list = client.get(
        f"/note-taker/sessions?eventId={other.id}", headers=headers
    )
    assert [item["id"] for item in maze_list.json()["sessions"]] == [session_id]
    assert [item["id"] for item in rally_list.json()["sessions"]] == [session_id]


def test_unlink_removes_fire_placement_but_keeps_meeting(
    make_profile, make_token, client, maze_event
):
    profile = make_profile(email="unlink@example.edu")
    headers = {"Authorization": f"Bearer {make_token(sub=profile.id)}"}
    created = client.post(
        "/note-taker/sessions",
        headers=headers,
        json={"title": "Keep me", "eventId": str(maze_event.id)},
    )
    session_id = created.json()["id"]
    assert str(maze_event.id) in created.json()["eventIds"]

    unlinked = client.delete(
        f"/note-taker/sessions/{session_id}/events/{maze_event.id}",
        headers=headers,
    )
    assert unlinked.status_code == 200
    assert unlinked.json()["eventIds"] == []
    assert unlinked.json()["eventId"] is None

    still_there = client.get(f"/note-taker/sessions/{session_id}", headers=headers)
    assert still_there.status_code == 200
    assert still_there.json()["title"] == "Keep me"

    empty = client.get(
        f"/note-taker/sessions?eventId={maze_event.id}", headers=headers
    )
    assert empty.json()["sessions"] == []


def test_member_cannot_link_another_users_log(
    make_profile, make_token, client, maze_event
):
    owner = make_profile(email="log-owner@example.edu")
    other = make_profile(email="log-thief@example.edu")
    created = client.post(
        "/note-taker/sessions",
        headers={"Authorization": f"Bearer {make_token(sub=owner.id)}"},
        json={"title": "Private log"},
    )
    denied = client.post(
        f"/note-taker/sessions/{created.json()['id']}/events/{maze_event.id}",
        headers={"Authorization": f"Bearer {make_token(sub=other.id)}"},
    )
    assert denied.status_code == 403
