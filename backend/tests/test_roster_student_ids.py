"""Student IDs stay separate from Auth passwords and sync by name/email."""

from __future__ import annotations

import json
import uuid
from pathlib import Path

from app.db.seed import seed_committees, seed_permissions_and_roles
from app.models import Profile
from app.models.attendance import AttendanceIdentity
from app.services import attendance, roster_ids
from app.services.roster_student_ids import sync_roster_student_ids


def test_load_student_ids_and_passwords_are_independent(tmp_path: Path, monkeypatch):
    ids_path = tmp_path / "roster_student_ids.json"
    pwd_path = tmp_path / "roster_credentials.json"
    ids_path.write_text(
        json.dumps(
            {
                "camper@example.edu": "111222",
                "by-name:Other Camper": "333444",
            }
        )
    )
    pwd_path.write_text(
        json.dumps(
            {
                "camper@example.edu": "totally-different-password",
            }
        )
    )
    monkeypatch.setattr(roster_ids, "STUDENT_IDS_PATH", ids_path)
    monkeypatch.setattr(roster_ids, "CREDENTIALS_PATH", pwd_path)

    ids = roster_ids.load_student_ids()
    passwords = roster_ids.load_initial_passwords()
    assert ids["camper@example.edu"] == "111222"
    assert passwords["camper@example.edu"] == "totally-different-password"
    assert ids["camper@example.edu"] != passwords["camper@example.edu"]

    assert (
        roster_ids.student_id_for_person(
            email="camper@example.edu", name="Camper", ids=ids
        )
        == "111222"
    )
    assert (
        roster_ids.student_id_for_person(
            email="missing@example.edu", name="Other Camper", ids=ids
        )
        == "333444"
    )


def test_sync_enrolls_student_id_onto_matching_name(db_session, tmp_path, monkeypatch):
    seed_permissions_and_roles(db_session)
    seed_committees(db_session)
    profile = Profile(
        id=uuid.uuid4(),
        email="ariel.duong@example.com",
        full_name="Ariel Duong",
        status="active",
    )
    db_session.add(profile)
    db_session.commit()

    ids_path = tmp_path / "roster_student_ids.json"
    # Roster email for Ariel is 1010cookiegram@gmail.com — match by name.
    ids_path.write_text(json.dumps({"by-name:Ariel Duong": "998877"}))
    monkeypatch.setattr(roster_ids, "STUDENT_IDS_PATH", ids_path)

    result = sync_roster_student_ids(db_session)
    assert result["missing_file"] is False
    assert result["enrolled"] == 1

    identity = db_session.get(AttendanceIdentity, profile.id)
    assert identity is not None
    assert identity.student_id_last4 == "8877"
    assert identity.student_id_digest == attendance.student_id_digest("998877")

    # Re-sync is idempotent and does not require a password file.
    again = sync_roster_student_ids(db_session)
    assert again["enrolled"] == 0
    assert again["updated"] == 0


def test_sync_roster_memberships_reports_student_id_counters(
    db_session, tmp_path, monkeypatch, make_profile
):
    from app.services.campers import sync_roster_memberships

    seed_permissions_and_roles(db_session)
    seed_committees(db_session)
    make_profile(
        email="1010cookiegram@gmail.com",
        full_name="Ariel Duong",
        role="member",
    )

    ids_path = tmp_path / "roster_student_ids.json"
    ids_path.write_text(json.dumps({"1010cookiegram@gmail.com": "556677"}))
    monkeypatch.setattr(roster_ids, "STUDENT_IDS_PATH", ids_path)

    result = sync_roster_memberships(db_session)
    assert result["student_ids_enrolled"] == 1
    assert result["student_ids_missing_file"] is False
