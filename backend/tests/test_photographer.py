"""Photographer public dropbox tests."""

from __future__ import annotations

import io

import pytest

from app.db.seed import SEED_EVENT_IDS, seed_development_users


@pytest.fixture
def seeded(db_session):
    return seed_development_users(db_session)


def test_public_events_list_needs_no_auth(client, seeded):
    response = client.get("/public/photographer/events")
    assert response.status_code == 200
    events = response.json()["events"]
    assert any(e["id"] == str(SEED_EVENT_IDS["fall_rally_2026"]) for e in events)
    # Calendar-only athletics imports stay off the picker.
    assert all(e.get("status") != "calendar" for e in events)


def test_permission_options_are_public(client):
    response = client.get("/public/photographer/options")
    assert response.status_code == 200
    values = {p["value"] for p in response.json()["permissions"]}
    assert values == {"instagram", "yearbook", "instagram_and_yearbook", "other"}


def test_submission_accepts_drive_link(client, seeded):
    event_id = str(SEED_EVENT_IDS["fall_rally_2026"])
    response = client.post(
        "/public/photographer/submissions",
        data={
            "eventId": event_id,
            "creditName": "@msj.lens · Avery Chen",
            "socialMediaUrl": "https://instagram.com/msj.lens",
            "permission": "instagram",
            "photographerName": "Avery Chen",
            "driveUrl": "https://drive.google.com/drive/folders/abc123",
            "notes": "Edited selects in folder",
        },
    )
    assert response.status_code == 201, response.text
    body = response.json()["submission"]
    assert body["eventId"] == event_id
    assert body["creditName"] == "@msj.lens · Avery Chen"
    assert body["hasDriveLink"] is True
    assert body["hasFile"] is False
    assert "storageKey" not in body


def test_submission_accepts_file_upload(client, seeded):
    event_id = str(SEED_EVENT_IDS["fall_rally_2026"])
    response = client.post(
        "/public/photographer/submissions",
        data={
            "eventId": event_id,
            "creditName": "Photo by Sam",
            "socialMediaUrl": "https://instagram.com/sam.shoots",
            "permission": "yearbook",
        },
        files={
            "file": ("rally.jpg", io.BytesIO(b"\xff\xd8\xfffakejpeg"), "image/jpeg"),
        },
    )
    assert response.status_code == 201, response.text
    body = response.json()["submission"]
    assert body["hasFile"] is True
    assert body["permission"] == "yearbook"


def test_submission_requires_drive_or_file(client, seeded):
    response = client.post(
        "/public/photographer/submissions",
        data={
            "eventId": str(SEED_EVENT_IDS["fall_rally_2026"]),
            "creditName": "Avery",
            "socialMediaUrl": "https://instagram.com/a",
            "permission": "other",
        },
    )
    assert response.status_code == 400
    assert "Drive" in response.json()["detail"] or "file" in response.json()["detail"]


def test_submission_rejects_bad_drive_host(client, seeded):
    response = client.post(
        "/public/photographer/submissions",
        data={
            "eventId": str(SEED_EVENT_IDS["fall_rally_2026"]),
            "creditName": "Avery",
            "socialMediaUrl": "https://instagram.com/a",
            "permission": "instagram",
            "driveUrl": "https://dropbox.com/folder/xyz",
        },
    )
    assert response.status_code == 400
