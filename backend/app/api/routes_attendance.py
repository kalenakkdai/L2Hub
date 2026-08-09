"""ASBO/AC attendance kiosk and scoped whereabouts-map API."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from urllib.parse import quote

from fastapi import APIRouter
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.api.deps import CurrentProfile, DbSession
from app.models.attendance import AttendanceIdentity, AttendanceRecord
from app.models.profile import Profile
from app.services import attendance

router = APIRouter(prefix="/attendance", tags=["attendance"])


class CreateDayBody(BaseModel):
    schoolDate: date | None = None
    startsAt: str | None = Field(default=None, pattern=r"^\d{2}:\d{2}$")
    endsAt: str | None = Field(default=None, pattern=r"^\d{2}:\d{2}$")


class IdentityBody(BaseModel):
    studentId: str = Field(min_length=4, max_length=64)
    parentEmail: str | None = Field(default=None, max_length=320)
    parentPhone: str | None = Field(default=None, max_length=40)


class ScanBody(BaseModel):
    studentId: str = Field(min_length=4, max_length=64)
    source: str = Field(default="barcode", pattern=r"^(barcode|keypad|passkey)$")


class EditRecordBody(BaseModel):
    status: str
    scorePercent: int = Field(ge=0, le=100)
    presentPercent: float = Field(ge=0, le=100)
    note: str | None = Field(default=None, max_length=1000)


class WhereaboutsBody(BaseModel):
    kind: str = Field(pattern=r"^(bathroom|errand)$")
    destinationKey: str
    studentId: str | None = Field(default=None, max_length=64)
    customName: str | None = Field(default=None, max_length=200)
    customDestination: str | None = Field(default=None, max_length=200)
    taskName: str | None = Field(default=None, max_length=500)


class PingBody(BaseModel):
    message: str = Field(min_length=1, max_length=500)


class PasskeyRegistrationBody(BaseModel):
    challengeId: uuid.UUID
    credential: dict
    deviceName: str = Field(default="Personal device", max_length=100)


class PasskeyAuthenticationBody(BaseModel):
    challengeId: uuid.UUID
    credential: dict


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def record_dict(record: AttendanceRecord) -> dict:
    profile = record.profile
    return {
        "id": str(record.id),
        "profileId": str(record.profile_id),
        "displayName": (
            profile.display_name or profile.full_name or profile.email
            if profile
            else "Unknown student"
        ),
        "checkedInAt": _iso(record.checked_in_at),
        "checkInSource": record.check_in_source,
        "late": record.late,
        "scorePercent": record.score_percent,
        "presentPercent": record.present_percent,
        "status": record.status,
        "manualNote": record.manual_note,
        "editedAt": _iso(record.edited_at),
        "parentAlertSentAt": _iso(record.parent_alert_sent_at),
        "needsAttention": record.present_percent < attendance.LOW_ATTENDANCE_PERCENT
        and record.status in {"under_80", "absent"},
    }


def day_dict(day, *, include_records: bool = True) -> dict:
    payload = {
        "id": str(day.id),
        "schoolDate": day.school_date.isoformat(),
        "startsAt": _iso(day.starts_at),
        "endsAt": _iso(day.ends_at),
        "status": day.status,
        "closedAt": _iso(day.closed_at),
        "recordCount": len(day.records),
    }
    if include_records:
        payload["records"] = [
            record_dict(record)
            for record in sorted(
                day.records,
                key=lambda item: (
                    item.profile.full_name or item.profile.email
                    if item.profile
                    else ""
                ),
            )
        ]
    return payload


def whereabouts_dict(entry) -> dict:
    return {
        "id": str(entry.id),
        "profileId": str(entry.profile_id) if entry.profile_id else None,
        "displayName": entry.display_name,
        "kind": entry.kind,
        "destinationKey": entry.destination_key,
        "customDestination": entry.custom_destination,
        "taskName": entry.task_name,
        "leftAt": _iso(entry.left_at),
        "returnedAt": _iso(entry.returned_at),
        "canSms": bool(
            entry.profile
            and entry.profile.phone
            and entry.profile.phone_verified
        ),
    }


@router.get("/days")
def list_days(profile: CurrentProfile, db: DbSession) -> dict:
    return {
        "days": [
            day_dict(day, include_records=False)
            for day in attendance.list_days(db, profile)
        ]
    }


@router.post("/days", status_code=201)
def create_day(
    body: CreateDayBody, profile: CurrentProfile, db: DbSession
) -> dict:
    day = attendance.create_or_get_day(
        db,
        profile,
        school_date=body.schoolDate,
        start_value=body.startsAt,
        end_value=body.endsAt,
    )
    return day_dict(attendance.get_day(db, profile, day.id))


@router.get("/days/{day_id}")
def get_day(day_id: uuid.UUID, profile: CurrentProfile, db: DbSession) -> dict:
    return day_dict(attendance.get_day(db, profile, day_id))


@router.post("/days/{day_id}/scan")
def scan(
    day_id: uuid.UUID,
    body: ScanBody,
    profile: CurrentProfile,
    db: DbSession,
) -> dict:
    record = attendance.check_in(
        db,
        profile,
        day_id=day_id,
        student_id=body.studentId,
        source=body.source,
    )
    record.profile = db.get(Profile, record.profile_id)
    return record_dict(record)


@router.post("/days/{day_id}/close")
def close_day(day_id: uuid.UUID, profile: CurrentProfile, db: DbSession) -> dict:
    attendance.close_day(db, profile, day_id)
    return day_dict(attendance.get_day(db, profile, day_id))


@router.patch("/records/{record_id}")
def edit_record(
    record_id: uuid.UUID,
    body: EditRecordBody,
    profile: CurrentProfile,
    db: DbSession,
) -> dict:
    record = attendance.edit_record(
        db,
        profile,
        record_id,
        status_value=body.status,
        score_percent=body.scorePercent,
        present_percent_value=body.presentPercent,
        note=body.note,
    )
    record.profile = db.get(Profile, record.profile_id)
    return record_dict(record)


@router.get("/identities")
def list_identities(profile: CurrentProfile, db: DbSession) -> dict:
    # The service check keeps parent contacts ASBO/AC-only.
    attendance.list_days(db, profile)
    identities = {
        item.profile_id: item
        for item in db.scalars(select(AttendanceIdentity)).all()
    }
    students = []
    for student in attendance.student_roster(db):
        identity = identities.get(student.id)
        students.append(
            {
                "profileId": str(student.id),
                "displayName": student.display_name
                or student.full_name
                or student.email,
                "studentIdLast4": identity.student_id_last4 if identity else None,
                "parentEmail": identity.parent_email if identity else None,
                "parentPhone": identity.parent_phone if identity else None,
                "passkeyOptIn": identity.passkey_opt_in if identity else False,
            }
        )
    return {"students": students}


@router.put("/identities/{profile_id}")
def put_identity(
    profile_id: uuid.UUID,
    body: IdentityBody,
    profile: CurrentProfile,
    db: DbSession,
) -> dict:
    identity = attendance.upsert_identity(
        db,
        profile,
        profile_id=profile_id,
        student_id=body.studentId,
        parent_email=body.parentEmail,
        parent_phone=body.parentPhone,
    )
    return {
        "profileId": str(identity.profile_id),
        "studentIdLast4": identity.student_id_last4,
        "parentEmail": identity.parent_email,
        "parentPhone": identity.parent_phone,
        "passkeyOptIn": identity.passkey_opt_in,
    }


@router.post("/passkeys/register/options")
def passkey_registration_options(
    profile: CurrentProfile, db: DbSession
) -> dict:
    return attendance.begin_passkey_registration(db, profile)


@router.post("/passkeys/register/verify", status_code=201)
def verify_passkey_registration(
    body: PasskeyRegistrationBody,
    profile: CurrentProfile,
    db: DbSession,
) -> dict:
    passkey = attendance.finish_passkey_registration(
        db,
        profile,
        challenge_id=body.challengeId,
        credential=body.credential,
        device_name=body.deviceName,
    )
    return {
        "id": str(passkey.id),
        "deviceName": passkey.device_name,
        "createdAt": _iso(passkey.created_at),
    }


@router.post("/days/{day_id}/passkey/options")
def passkey_authentication_options(
    day_id: uuid.UUID, profile: CurrentProfile, db: DbSession
) -> dict:
    return attendance.begin_passkey_authentication(
        db, profile, day_id=day_id
    )


@router.post("/days/{day_id}/passkey/verify")
def verify_passkey_authentication(
    day_id: uuid.UUID,
    body: PasskeyAuthenticationBody,
    profile: CurrentProfile,
    db: DbSession,
) -> dict:
    record = attendance.finish_passkey_authentication(
        db,
        profile,
        challenge_id=body.challengeId,
        day_id=day_id,
        credential=body.credential,
    )
    record.profile = db.get(Profile, record.profile_id)
    return record_dict(record)


@router.get("/whereabouts")
def list_whereabouts(profile: CurrentProfile, db: DbSession) -> dict:
    return {
        "entries": [
            whereabouts_dict(entry)
            for entry in attendance.active_whereabouts(db, profile)
        ]
    }


@router.post("/whereabouts", status_code=201)
def start_whereabouts(
    body: WhereaboutsBody, profile: CurrentProfile, db: DbSession
) -> dict:
    entry = attendance.start_whereabouts(
        db,
        profile,
        kind=body.kind,
        destination_key=body.destinationKey,
        student_id=body.studentId,
        custom_name=body.customName,
        custom_destination=body.customDestination,
        task_name=body.taskName,
    )
    if entry.profile_id:
        entry.profile = db.get(Profile, entry.profile_id)
    return whereabouts_dict(entry)


@router.post("/whereabouts/{entry_id}/return")
def return_whereabouts(
    entry_id: uuid.UUID, profile: CurrentProfile, db: DbSession
) -> dict:
    entry = attendance.return_whereabouts(db, profile, entry_id)
    if entry.profile_id:
        entry.profile = db.get(Profile, entry.profile_id)
    return whereabouts_dict(entry)


@router.post("/whereabouts/{entry_id}/ping")
def ping_whereabouts(
    entry_id: uuid.UUID,
    body: PingBody,
    profile: CurrentProfile,
    db: DbSession,
) -> dict:
    ping, phone = attendance.ping_whereabouts(
        db, profile, entry_id, message=body.message
    )
    return {
        "id": str(ping.id),
        "deliveryStatus": ping.delivery_status,
        "smsPhone": phone,
        "smsUrl": f"sms:{phone}?body={quote(body.message)}" if phone else None,
    }
