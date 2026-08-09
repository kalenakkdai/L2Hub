import uuid
from datetime import UTC, date, datetime, timedelta
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from sqlalchemy import select
from webauthn.helpers import bytes_to_base64url

from app.core import permission_keys as pk
from app.core.role_catalog import ROLE_PERMISSION_BUNDLES
from app.models.attendance import (
    AttendanceDay,
    AttendanceIdentity,
    AttendanceRecord,
    ParentAlert,
    WhereaboutsEntry,
)
from app.models.rbac import Committee, CommitteeMembership
from app.services import attendance


def test_attendance_permissions_are_role_scoped():
    assert pk.ATTENDANCE_MANAGE_ALL in ROLE_PERMISSION_BUNDLES["asbo"]
    assert pk.ATTENDANCE_MANAGE_ALL in ROLE_PERMISSION_BUNDLES["ac"]
    assert pk.ATTENDANCE_MANAGE_ALL not in ROLE_PERMISSION_BUNDLES["committee_head"]
    assert pk.ATTENDANCE_VIEW_COMMITTEE in ROLE_PERMISSION_BUNDLES["committee_head"]
    assert pk.ATTENDANCE_VIEW_ALL not in ROLE_PERMISSION_BUNDLES["member"]


def test_student_id_is_normalized_and_hashed_without_storing_the_raw_value():
    first = attendance.student_id_digest(" 12-34 56 ")
    second = attendance.student_id_digest("123456")
    assert first == second
    assert first != "123456"
    assert len(first) == 64


@pytest.mark.parametrize(
    ("seconds_after_start", "expected"),
    [(60, False), (61, True), (-10, False)],
)
def test_late_penalty_starts_after_full_one_minute(seconds_after_start, expected):
    starts_at = datetime(2026, 8, 8, 15, 0, tzinfo=UTC)
    assert (
        attendance.is_late(
            starts_at=starts_at,
            checked_in_at=starts_at + timedelta(seconds=seconds_after_start),
        )
        is expected
    )
    assert attendance.attendance_score(late=expected) == (90 if expected else 100)


def _headers(make_token, profile):
    return {"Authorization": f"Bearer {make_token(sub=profile.id)}"}


def _create_day(client, headers):
    response = client.post(
        "/attendance/days",
        headers=headers,
        json={
            "schoolDate": "2026-08-08",
            "startsAt": "08:00",
            "endsAt": "08:50",
        },
    )
    assert response.status_code == 201
    return response.json()


def test_member_cannot_open_attendance_console(make_profile, make_token, client):
    member = make_profile(email="student@example.edu")
    response = client.post(
        "/attendance/days",
        headers=_headers(make_token, member),
        json={"schoolDate": "2026-08-08"},
    )
    assert response.status_code == 403


def test_asbo_can_enroll_scan_and_manually_edit_attendance(
    make_profile, make_token, client
):
    operator = make_profile(email="asbo@example.edu", role="asbo")
    student = make_profile(email="camper@example.edu", full_name="Camp Er", role="member")
    headers = _headers(make_token, operator)

    enrolled = client.put(
        f"/attendance/identities/{student.id}",
        headers=headers,
        json={
            "studentId": "123-456",
            "parentEmail": "parent@example.edu",
            "parentPhone": "+15105550100",
        },
    )
    assert enrolled.status_code == 200
    assert enrolled.json()["studentIdLast4"] == "3456"
    assert "123456" not in str(enrolled.json())

    day = _create_day(client, headers)
    scanned = client.post(
        f"/attendance/days/{day['id']}/scan",
        headers=headers,
        json={"studentId": "123456", "source": "barcode"},
    )
    assert scanned.status_code == 200
    assert scanned.json()["displayName"] == "Camp Er"
    assert scanned.json()["checkInSource"] == "barcode"

    duplicate = client.post(
        f"/attendance/days/{day['id']}/scan",
        headers=headers,
        json={"studentId": "123456", "source": "keypad"},
    )
    assert duplicate.status_code == 409

    edited = client.patch(
        f"/attendance/records/{scanned.json()['id']}",
        headers=headers,
        json={
            "status": "excused",
            "scorePercent": 100,
            "presentPercent": 100,
            "note": "Counselor appointment",
        },
    )
    assert edited.status_code == 200
    assert edited.json()["status"] == "excused"
    assert edited.json()["manualNote"] == "Counselor appointment"


def test_unenrolled_barcode_is_rejected(make_profile, make_token, client):
    operator = make_profile(email="ac@example.edu", role="ac")
    headers = _headers(make_token, operator)
    day = _create_day(client, headers)
    response = client.post(
        f"/attendance/days/{day['id']}/scan",
        headers=headers,
        json={"studentId": "999999", "source": "barcode"},
    )
    assert response.status_code == 404


def test_presence_percent_subtracts_late_arrival_and_time_out_of_room(
    db_session, make_profile
):
    student = make_profile(email="time@example.edu")
    starts = datetime(2026, 8, 8, 15, 0, tzinfo=UTC)
    day = AttendanceDay(
        id=uuid.uuid4(),
        school_date=date(2026, 8, 8),
        starts_at=starts,
        ends_at=starts + timedelta(minutes=50),
        status="closed",
        created_by=student.id,
    )
    record = AttendanceRecord(
        id=uuid.uuid4(),
        day_id=day.id,
        profile_id=student.id,
        checked_in_at=starts + timedelta(minutes=5),
        status="late",
    )
    outside = WhereaboutsEntry(
        id=uuid.uuid4(),
        profile_id=student.id,
        display_name="Student",
        kind="bathroom",
        destination_key="bathroom",
        left_at=starts + timedelta(minutes=20),
        returned_at=starts + timedelta(minutes=30),
        initiated_by=student.id,
    )
    # 45 minutes after late arrival, minus 10 outside = 35 / 50 = 70%.
    assert attendance.presence_percent(
        day=day, record=record, whereabouts=[outside]
    ) == 70.0


def test_closing_day_flags_under_80_and_queues_parent_email(
    db_session, make_profile
):
    operator = make_profile(email="jan@example.edu", role="ac")
    student = make_profile(email="low@example.edu", full_name="Low Attendance")
    day = attendance.create_or_get_day(
        db_session,
        operator,
        school_date=date(2026, 8, 8),
        start_value="08:00",
        end_value="08:50",
    )
    identity = AttendanceIdentity(
        profile_id=student.id,
        student_id_digest=attendance.student_id_digest("445566"),
        student_id_last4="5566",
        parent_email="parent@example.edu",
    )
    db_session.add(identity)
    record = db_session.scalar(
        select(AttendanceRecord).where(
            AttendanceRecord.day_id == day.id,
            AttendanceRecord.profile_id == student.id,
        )
    )
    assert record is not None
    record.checked_in_at = day.starts_at + timedelta(minutes=20)
    record.status = "late"
    record.score_percent = 90
    db_session.commit()

    attendance.close_day(db_session, operator, day.id, moment=day.ends_at)
    db_session.refresh(record)
    assert record.present_percent == 60.0
    assert record.status == "under_80"
    alert = db_session.scalar(
        select(ParentAlert).where(
            ParentAlert.attendance_record_id == record.id
        )
    )
    assert alert is not None
    # SMTP is intentionally unset in tests: queued is honest, "sent" would not be.
    assert alert.status == "queued"


def test_bathroom_requires_student_id_but_errand_accepts_a_name(
    db_session, make_profile
):
    operator = make_profile(email="jan2@example.edu", role="ac")
    with pytest.raises(HTTPException) as exc_info:
        attendance.start_whereabouts(
            db_session,
            operator,
            kind="bathroom",
            destination_key="bathroom",
            student_id=None,
            custom_name="No ID",
            custom_destination=None,
            task_name=None,
        )
    assert exc_info.value.status_code == 400

    errand = attendance.start_whereabouts(
        db_session,
        operator,
        kind="errand",
        destination_key="office",
        student_id=None,
        custom_name="Alex",
        custom_destination=None,
        task_name="Pick up forms",
    )
    assert errand.display_name == "Alex"
    assert errand.task_name == "Pick up forms"


def test_passkey_registration_stores_only_public_key_material(
    db_session, make_profile, monkeypatch
):
    student = make_profile(email="passkey@example.edu")
    db_session.add(
        AttendanceIdentity(
            profile_id=student.id,
            student_id_digest=attendance.student_id_digest("778899"),
            student_id_last4="8899",
        )
    )
    db_session.commit()
    started = attendance.begin_passkey_registration(db_session, student)
    assert started["options"]["rp"]["id"] == "localhost"
    assert started["options"]["authenticatorSelection"]["userVerification"] == "required"

    monkeypatch.setattr(
        attendance,
        "verify_registration_response",
        lambda **_: SimpleNamespace(
            credential_id=b"credential-id",
            credential_public_key=b"public-key-only",
            sign_count=0,
        ),
    )
    passkey = attendance.finish_passkey_registration(
        db_session,
        student,
        challenge_id=uuid.UUID(started["challengeId"]),
        credential={"id": bytes_to_base64url(b"credential-id")},
        device_name="My iPhone",
    )
    assert passkey.public_key == b"public-key-only"
    assert passkey.device_name == "My iPhone"
    identity = db_session.get(AttendanceIdentity, student.id)
    assert identity is not None and identity.passkey_opt_in


def test_verified_passkey_checks_its_owner_into_operator_day(
    db_session, make_profile, monkeypatch
):
    operator = make_profile(email="passkey-asbo@example.edu", role="asbo")
    student = make_profile(email="passkey-student@example.edu")
    db_session.add(
        AttendanceIdentity(
            profile_id=student.id,
            student_id_digest=attendance.student_id_digest("112233"),
            student_id_last4="2233",
        )
    )
    db_session.commit()
    registration = attendance.begin_passkey_registration(db_session, student)
    monkeypatch.setattr(
        attendance,
        "verify_registration_response",
        lambda **_: SimpleNamespace(
            credential_id=b"credential-two",
            credential_public_key=b"public-two",
            sign_count=2,
        ),
    )
    attendance.finish_passkey_registration(
        db_session,
        student,
        challenge_id=uuid.UUID(registration["challengeId"]),
        credential={"id": bytes_to_base64url(b"credential-two")},
        device_name="Touch ID",
    )
    day = attendance.create_or_get_day(
        db_session,
        operator,
        school_date=date(2026, 8, 9),
        start_value="08:00",
        end_value="08:50",
    )
    started = attendance.begin_passkey_authentication(
        db_session, operator, day_id=day.id
    )
    monkeypatch.setattr(
        attendance,
        "verify_authentication_response",
        lambda **_: SimpleNamespace(new_sign_count=3),
    )
    record = attendance.finish_passkey_authentication(
        db_session,
        operator,
        challenge_id=uuid.UUID(started["challengeId"]),
        day_id=day.id,
        credential={"id": bytes_to_base64url(b"credential-two")},
    )
    assert record.profile_id == student.id
    assert record.check_in_source == "passkey"


def test_committee_head_map_is_filtered_to_led_committee(
    db_session, make_profile
):
    head = make_profile(email="head-map@example.edu", role="committee_head")
    own_student = make_profile(email="own-map@example.edu", full_name="Own Member")
    other_student = make_profile(
        email="other-map@example.edu", full_name="Other Member"
    )
    own = Committee(id=uuid.uuid4(), slug="map-own", name="Own")
    other = Committee(id=uuid.uuid4(), slug="map-other", name="Other")
    db_session.add_all([own, other])
    db_session.flush()
    db_session.add_all(
        [
            CommitteeMembership(
                user_id=head.id,
                committee_id=own.id,
                membership_type="head",
                is_head=True,
            ),
            CommitteeMembership(
                user_id=own_student.id,
                committee_id=own.id,
                membership_type="member",
                is_head=False,
            ),
            CommitteeMembership(
                user_id=other_student.id,
                committee_id=other.id,
                membership_type="member",
                is_head=False,
            ),
            WhereaboutsEntry(
                id=uuid.uuid4(),
                profile_id=own_student.id,
                display_name="Own Member",
                kind="errand",
                destination_key="office",
                left_at=attendance.now_utc(),
                initiated_by=head.id,
            ),
            WhereaboutsEntry(
                id=uuid.uuid4(),
                profile_id=other_student.id,
                display_name="Other Member",
                kind="errand",
                destination_key="library",
                left_at=attendance.now_utc(),
                initiated_by=head.id,
            ),
        ]
    )
    db_session.commit()
    db_session.expire(head, ["committee_memberships"])

    visible = attendance.active_whereabouts(db_session, head)
    assert [entry.display_name for entry in visible] == ["Own Member"]
