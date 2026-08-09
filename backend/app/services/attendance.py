"""Server-authoritative daily attendance and whereabouts logic."""

from __future__ import annotations

import hashlib
import hmac
import json
import smtplib
import uuid
from datetime import UTC, date, datetime, time, timedelta
from email.message import EmailMessage
from zoneinfo import ZoneInfo

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload
from webauthn import (
    generate_authentication_options,
    generate_registration_options,
    options_to_json,
    verify_authentication_response,
    verify_registration_response,
)
from webauthn.helpers import base64url_to_bytes
from webauthn.helpers.structs import (
    AuthenticatorAttachment,
    AuthenticatorSelectionCriteria,
    PublicKeyCredentialDescriptor,
    ResidentKeyRequirement,
    UserVerificationRequirement,
)

from app.core import permission_keys as pk
from app.core.config import settings
from app.models.attendance import (
    AttendanceDay,
    AttendanceIdentity,
    AttendancePasskey,
    AttendancePasskeyChallenge,
    AttendanceRecord,
    ParentAlert,
    WhereaboutsEntry,
    WhereaboutsPing,
)
from app.models.profile import Profile
from app.models.rbac import CommitteeMembership
from app.services import authorization as authz
from app.services.notifications import deliver

LATE_GRACE_SECONDS = 60
LOW_ATTENDANCE_PERCENT = 80
VALID_DESTINATIONS = frozenset(
    {
        "classroom",
        "bathroom",
        "office",
        "student_store",
        "library",
        "gym",
        "cafeteria",
        "parking_lot",
        "other",
    }
)


def now_utc() -> datetime:
    return datetime.now(UTC)


def as_utc(value: datetime) -> datetime:
    """SQLite drops timezone metadata; restore UTC before doing arithmetic."""
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def normalize_student_id(raw: str) -> str:
    normalized = "".join(character for character in raw if character.isalnum()).upper()
    if not 4 <= len(normalized) <= 32:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Student ID must contain 4 to 32 letters or digits.",
        )
    return normalized


def student_id_digest(raw: str) -> str:
    normalized = normalize_student_id(raw)
    if (
        settings.environment != "development"
        and settings.attendance_id_pepper == "local-development-only-change-me"
    ):
        raise HTTPException(
            status_code=500,
            detail="Attendance ID hashing is not configured.",
        )
    return hmac.new(
        settings.attendance_id_pepper.encode(),
        normalized.encode(),
        hashlib.sha256,
    ).hexdigest()


def is_late(*, checked_in_at: datetime, starts_at: datetime) -> bool:
    return (
        as_utc(checked_in_at) - as_utc(starts_at)
    ).total_seconds() > LATE_GRACE_SECONDS


def attendance_score(*, late: bool) -> int:
    return 90 if late else 100


def _configured_time(value: str, fallback: time) -> time:
    try:
        hour, minute = (int(piece) for piece in value.split(":", 1))
        return time(hour=hour, minute=minute)
    except (TypeError, ValueError):
        return fallback


def configured_window(
    school_date: date,
    *,
    start_value: str | None = None,
    end_value: str | None = None,
) -> tuple[datetime, datetime]:
    zone = ZoneInfo(settings.attendance_timezone)
    starts = _configured_time(
        start_value or settings.attendance_class_start, time(hour=8)
    )
    ends = _configured_time(end_value or settings.attendance_class_end, time(hour=8, minute=50))
    start_at = datetime.combine(school_date, starts, tzinfo=zone).astimezone(UTC)
    end_at = datetime.combine(school_date, ends, tzinfo=zone).astimezone(UTC)
    if end_at <= start_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Class end time must be after its start time.",
        )
    return start_at, end_at


def student_roster(db: Session) -> list[Profile]:
    """Active profiles that participate in Leadership, excluding faculty-only users."""
    profiles = list(
        db.scalars(
            select(Profile)
            .where(Profile.status == "active")
            .options(selectinload(Profile.role_assignments))
            .order_by(Profile.full_name, Profile.email)
        ).all()
    )
    roster: list[Profile] = []
    for profile in profiles:
        context = authz.build_auth_context(db, profile)
        slugs = {role["slug"] for role in context.roles}
        if slugs and slugs <= {"ac", "class_advisor"}:
            continue
        roster.append(profile)
    return roster


def create_or_get_day(
    db: Session,
    operator: Profile,
    *,
    school_date: date | None = None,
    start_value: str | None = None,
    end_value: str | None = None,
) -> AttendanceDay:
    authz.require_permission(db, operator, pk.ATTENDANCE_MANAGE_ALL)
    local_today = now_utc().astimezone(ZoneInfo(settings.attendance_timezone)).date()
    target_date = school_date or local_today
    existing = db.scalar(
        select(AttendanceDay).where(AttendanceDay.school_date == target_date)
    )
    if existing is not None:
        return existing

    starts_at, ends_at = configured_window(
        target_date, start_value=start_value, end_value=end_value
    )
    day = AttendanceDay(
        id=uuid.uuid4(),
        school_date=target_date,
        starts_at=starts_at,
        ends_at=ends_at,
        status="open",
        created_by=operator.id,
    )
    db.add(day)
    db.flush()
    for profile in student_roster(db):
        db.add(
            AttendanceRecord(
                id=uuid.uuid4(),
                day_id=day.id,
                profile_id=profile.id,
                status="absent",
                score_percent=0,
                present_percent=0,
            )
        )
    db.commit()
    return day


def get_day(db: Session, operator: Profile, day_id: uuid.UUID) -> AttendanceDay:
    authz.require_permission(db, operator, pk.ATTENDANCE_VIEW_ALL)
    day = db.get(
        AttendanceDay,
        day_id,
        options=(
            selectinload(AttendanceDay.records).selectinload(AttendanceRecord.profile),
        ),
    )
    if day is None:
        raise HTTPException(status_code=404, detail="Attendance day not found.")
    return day


def list_days(db: Session, operator: Profile) -> list[AttendanceDay]:
    authz.require_permission(db, operator, pk.ATTENDANCE_VIEW_ALL)
    return list(
        db.scalars(
            select(AttendanceDay)
            .options(selectinload(AttendanceDay.records))
            .order_by(AttendanceDay.school_date.desc())
        ).all()
    )


def upsert_identity(
    db: Session,
    operator: Profile,
    *,
    profile_id: uuid.UUID,
    student_id: str,
    parent_email: str | None,
    parent_phone: str | None,
) -> AttendanceIdentity:
    authz.require_permission(db, operator, pk.ATTENDANCE_MANAGE_ALL)
    if db.get(Profile, profile_id) is None:
        raise HTTPException(status_code=404, detail="Student not found.")
    normalized = normalize_student_id(student_id)
    identity = db.get(AttendanceIdentity, profile_id)
    if identity is None:
        identity = AttendanceIdentity(profile_id=profile_id)
        db.add(identity)
    identity.student_id_digest = student_id_digest(normalized)
    identity.student_id_last4 = normalized[-4:]
    identity.parent_email = (parent_email or "").strip() or None
    identity.parent_phone = (parent_phone or "").strip() or None
    identity.updated_at = now_utc()
    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="That student ID is already assigned.",
        ) from exc
    db.refresh(identity)
    return identity


def find_profile_by_student_id(db: Session, raw: str) -> Profile:
    identity = db.scalar(
        select(AttendanceIdentity).where(
            AttendanceIdentity.student_id_digest == student_id_digest(raw)
        )
    )
    if identity is None:
        raise HTTPException(status_code=404, detail="Student ID is not enrolled.")
    profile = db.get(Profile, identity.profile_id)
    if profile is None or profile.status != "active":
        raise HTTPException(status_code=404, detail="Student is not active.")
    return profile


def _expected_origins() -> str | list[str]:
    if settings.environment == "development":
        return list(
            dict.fromkeys(
                [
                    settings.webauthn_origin,
                    "http://localhost:5173",
                    "http://127.0.0.1:5173",
                    "http://[::1]:5173",
                ]
            )
        )
    return settings.webauthn_origin


def begin_passkey_registration(db: Session, profile: Profile) -> dict:
    """Start opt-in registration on the student's own device."""
    identity = db.get(AttendanceIdentity, profile.id)
    if identity is None:
        raise HTTPException(
            status_code=409,
            detail="Ask ASBO or Jan to enroll your student ID before adding a passkey.",
        )
    existing = list(
        db.scalars(
            select(AttendancePasskey).where(
                AttendancePasskey.profile_id == profile.id
            )
        ).all()
    )
    options = generate_registration_options(
        rp_id=settings.webauthn_rp_id,
        rp_name=settings.app_name,
        user_id=profile.id.bytes,
        user_name=profile.email,
        user_display_name=profile.display_name or profile.full_name or profile.email,
        authenticator_selection=AuthenticatorSelectionCriteria(
            authenticator_attachment=AuthenticatorAttachment.PLATFORM,
            resident_key=ResidentKeyRequirement.REQUIRED,
            user_verification=UserVerificationRequirement.REQUIRED,
        ),
        exclude_credentials=[
            PublicKeyCredentialDescriptor(id=credential.credential_id)
            for credential in existing
        ],
    )
    challenge = AttendancePasskeyChallenge(
        id=uuid.uuid4(),
        profile_id=profile.id,
        purpose="registration",
        challenge=options.challenge,
        expires_at=now_utc() + timedelta(minutes=5),
    )
    db.add(challenge)
    db.commit()
    return {
        "challengeId": str(challenge.id),
        "options": json.loads(options_to_json(options)),
    }


def finish_passkey_registration(
    db: Session,
    profile: Profile,
    *,
    challenge_id: uuid.UUID,
    credential: dict,
    device_name: str,
) -> AttendancePasskey:
    challenge = db.get(AttendancePasskeyChallenge, challenge_id)
    if (
        challenge is None
        or challenge.profile_id != profile.id
        or challenge.purpose != "registration"
        or as_utc(challenge.expires_at) < now_utc()
    ):
        raise HTTPException(status_code=400, detail="Passkey challenge expired.")
    try:
        verified = verify_registration_response(
            credential=credential,
            expected_challenge=challenge.challenge,
            expected_rp_id=settings.webauthn_rp_id,
            expected_origin=_expected_origins(),
            require_user_verification=True,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=400, detail="Passkey registration could not be verified."
        ) from exc
    passkey = AttendancePasskey(
        id=uuid.uuid4(),
        profile_id=profile.id,
        credential_id=verified.credential_id,
        public_key=verified.credential_public_key,
        sign_count=verified.sign_count,
        device_name=device_name.strip()[:100] or "Personal device",
    )
    identity = db.get(AttendanceIdentity, profile.id)
    assert identity is not None
    identity.passkey_opt_in = True
    identity.updated_at = now_utc()
    db.add(passkey)
    db.delete(challenge)
    db.commit()
    db.refresh(passkey)
    return passkey


def begin_passkey_authentication(
    db: Session, operator: Profile, *, day_id: uuid.UUID
) -> dict:
    authz.require_permission(db, operator, pk.ATTENDANCE_MANAGE_ALL)
    day = db.get(AttendanceDay, day_id)
    if day is None or day.status != "open":
        raise HTTPException(status_code=409, detail="Attendance day is not open.")
    options = generate_authentication_options(
        rp_id=settings.webauthn_rp_id,
        user_verification=UserVerificationRequirement.REQUIRED,
    )
    challenge = AttendancePasskeyChallenge(
        id=uuid.uuid4(),
        profile_id=operator.id,
        day_id=day.id,
        purpose="authentication",
        challenge=options.challenge,
        expires_at=now_utc() + timedelta(minutes=5),
    )
    db.add(challenge)
    db.commit()
    return {
        "challengeId": str(challenge.id),
        "options": json.loads(options_to_json(options)),
    }


def finish_passkey_authentication(
    db: Session,
    operator: Profile,
    *,
    challenge_id: uuid.UUID,
    day_id: uuid.UUID,
    credential: dict,
) -> AttendanceRecord:
    authz.require_permission(db, operator, pk.ATTENDANCE_MANAGE_ALL)
    challenge = db.get(AttendancePasskeyChallenge, challenge_id)
    if (
        challenge is None
        or challenge.profile_id != operator.id
        or challenge.day_id != day_id
        or challenge.purpose != "authentication"
        or as_utc(challenge.expires_at) < now_utc()
    ):
        raise HTTPException(status_code=400, detail="Passkey challenge expired.")
    credential_id = credential.get("id")
    if not isinstance(credential_id, str):
        raise HTTPException(status_code=400, detail="Passkey credential is missing.")
    passkey = db.scalar(
        select(AttendancePasskey).where(
            AttendancePasskey.credential_id == base64url_to_bytes(credential_id)
        )
    )
    if passkey is None:
        raise HTTPException(status_code=404, detail="Passkey is not enrolled.")
    try:
        verified = verify_authentication_response(
            credential=credential,
            expected_challenge=challenge.challenge,
            expected_rp_id=settings.webauthn_rp_id,
            expected_origin=_expected_origins(),
            credential_public_key=passkey.public_key,
            credential_current_sign_count=passkey.sign_count,
            require_user_verification=True,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=400, detail="Passkey check-in could not be verified."
        ) from exc
    profile = db.get(Profile, passkey.profile_id)
    if profile is None or profile.status != "active":
        raise HTTPException(status_code=404, detail="Passkey owner is not active.")
    passkey.sign_count = verified.new_sign_count
    passkey.last_used_at = now_utc()
    db.delete(challenge)
    db.flush()
    return check_in_profile(
        db,
        operator,
        day_id=challenge.day_id,
        profile=profile,
        source="passkey",
    )


def check_in(
    db: Session,
    operator: Profile,
    *,
    day_id: uuid.UUID,
    student_id: str,
    source: str,
    moment: datetime | None = None,
) -> AttendanceRecord:
    authz.require_permission(db, operator, pk.ATTENDANCE_MANAGE_ALL)
    profile = find_profile_by_student_id(db, student_id)
    return check_in_profile(
        db,
        operator,
        day_id=day_id,
        profile=profile,
        source=source,
        moment=moment,
    )


def check_in_profile(
    db: Session,
    operator: Profile,
    *,
    day_id: uuid.UUID,
    profile: Profile,
    source: str,
    moment: datetime | None = None,
) -> AttendanceRecord:
    """Check in a known profile after barcode/keypad or passkey verification."""
    authz.require_permission(db, operator, pk.ATTENDANCE_MANAGE_ALL)
    day = db.get(AttendanceDay, day_id)
    if day is None:
        raise HTTPException(status_code=404, detail="Attendance day not found.")
    if day.status != "open":
        raise HTTPException(status_code=409, detail="Attendance day is closed.")
    record = db.scalar(
        select(AttendanceRecord).where(
            AttendanceRecord.day_id == day.id,
            AttendanceRecord.profile_id == profile.id,
        )
    )
    if record is None:
        record = AttendanceRecord(
            id=uuid.uuid4(), day_id=day.id, profile_id=profile.id
        )
        db.add(record)
    if record.checked_in_at is not None:
        raise HTTPException(status_code=409, detail="Student is already checked in.")
    checked_at = moment or now_utc()
    late = is_late(checked_in_at=checked_at, starts_at=day.starts_at)
    record.checked_in_at = checked_at
    record.check_in_source = source
    record.late = late
    record.score_percent = attendance_score(late=late)
    record.status = "late" if late else "present"
    record.updated_at = now_utc()
    db.commit()
    db.refresh(record)
    return record


def _overlap_seconds(
    start: datetime, end: datetime, left: datetime, returned: datetime | None
) -> float:
    start = as_utc(start)
    end = as_utc(end)
    left = as_utc(left)
    returned = as_utc(returned) if returned else None
    overlap_start = max(start, left)
    overlap_end = min(end, returned or end)
    return max(0.0, (overlap_end - overlap_start).total_seconds())


def presence_percent(
    *,
    day: AttendanceDay,
    record: AttendanceRecord,
    whereabouts: list[WhereaboutsEntry],
    through: datetime | None = None,
) -> float:
    starts_at = as_utc(day.starts_at)
    ends_at = as_utc(day.ends_at)
    end = min(as_utc(through) if through else ends_at, ends_at)
    if record.checked_in_at is None or end <= starts_at:
        return 0.0
    duration = max(1.0, (end - starts_at).total_seconds())
    arrival = max(as_utc(record.checked_in_at), starts_at)
    present = max(0.0, (end - arrival).total_seconds())
    for entry in whereabouts:
        present -= _overlap_seconds(arrival, end, entry.left_at, entry.returned_at)
    return round(max(0.0, min(100.0, present / duration * 100)), 1)


def _queue_parent_alert(
    db: Session, record: AttendanceRecord, identity: AttendanceIdentity | None
) -> ParentAlert | None:
    if identity is None or not identity.parent_email:
        return None
    existing = db.scalar(
        select(ParentAlert).where(
            ParentAlert.attendance_record_id == record.id
        )
    )
    if existing is not None:
        return existing
    name = record.profile.full_name or record.profile.email
    alert = ParentAlert(
        id=uuid.uuid4(),
        attendance_record_id=record.id,
        recipient_email=identity.parent_email,
        subject=f"Leadership attendance notice for {name}",
        body=(
            f"{name} was present for {record.present_percent:.0f}% of Leadership "
            f"on {record.day.school_date.isoformat()}, below the 80% threshold. "
            "Please contact Mr. Jan if this record needs correction."
        ),
        status="queued",
    )
    db.add(alert)
    return alert


def deliver_parent_alert(alert: ParentAlert) -> bool:
    """Send through configured SMTP; never claim delivery when SMTP is absent."""
    if not settings.smtp_host or not settings.smtp_from_email:
        return False
    message = EmailMessage()
    message["From"] = settings.smtp_from_email
    message["To"] = alert.recipient_email
    message["Subject"] = alert.subject
    message.set_content(alert.body)
    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as smtp:
            if settings.smtp_use_tls:
                smtp.starttls()
            if settings.smtp_username:
                smtp.login(settings.smtp_username, settings.smtp_password)
            smtp.send_message(message)
    except (OSError, smtplib.SMTPException) as exc:
        alert.status = "failed"
        alert.error_message = str(exc)[:500]
        return False
    alert.status = "sent"
    alert.sent_at = now_utc()
    alert.error_message = None
    return True


def close_day(
    db: Session,
    operator: Profile,
    day_id: uuid.UUID,
    *,
    moment: datetime | None = None,
) -> AttendanceDay:
    authz.require_permission(db, operator, pk.ATTENDANCE_MANAGE_ALL)
    day = db.get(
        AttendanceDay,
        day_id,
        options=(
            selectinload(AttendanceDay.records).selectinload(AttendanceRecord.profile),
        ),
    )
    if day is None:
        raise HTTPException(status_code=404, detail="Attendance day not found.")
    if day.status == "closed":
        raise HTTPException(status_code=409, detail="Attendance day is already closed.")
    closed_at = moment or now_utc()
    whereabouts = list(
        db.scalars(
            select(WhereaboutsEntry).where(
                WhereaboutsEntry.profile_id.in_(
                    [record.profile_id for record in day.records]
                ),
                WhereaboutsEntry.left_at < day.ends_at,
            )
        ).all()
    )
    by_profile: dict[uuid.UUID, list[WhereaboutsEntry]] = {}
    for entry in whereabouts:
        if entry.profile_id is not None:
            by_profile.setdefault(entry.profile_id, []).append(entry)
    for record in day.records:
        record.present_percent = presence_percent(
            day=day,
            record=record,
            whereabouts=by_profile.get(record.profile_id, []),
            through=closed_at,
        )
        if record.checked_in_at is None:
            record.status = "absent"
            record.score_percent = 0
        elif record.present_percent < LOW_ATTENDANCE_PERCENT:
            record.status = "under_80"
        identity = db.get(AttendanceIdentity, record.profile_id)
        if record.present_percent < LOW_ATTENDANCE_PERCENT:
            alert = _queue_parent_alert(db, record, identity)
            if alert is not None and deliver_parent_alert(alert):
                record.parent_alert_sent_at = alert.sent_at
        record.updated_at = now_utc()
    day.status = "closed"
    day.closed_at = closed_at
    db.commit()
    return day


def edit_record(
    db: Session,
    operator: Profile,
    record_id: uuid.UUID,
    *,
    status_value: str,
    score_percent: int,
    present_percent_value: float,
    note: str | None,
) -> AttendanceRecord:
    authz.require_permission(db, operator, pk.ATTENDANCE_MANAGE_ALL)
    record = db.get(AttendanceRecord, record_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Attendance record not found.")
    if status_value not in {"present", "late", "absent", "excused", "under_80"}:
        raise HTTPException(status_code=400, detail="Invalid attendance status.")
    record.status = status_value
    record.score_percent = max(0, min(100, score_percent))
    record.present_percent = max(0.0, min(100.0, present_percent_value))
    record.manual_note = (note or "").strip() or None
    record.edited_by = operator.id
    record.edited_at = now_utc()
    record.updated_at = now_utc()
    db.commit()
    db.refresh(record)
    return record


def start_whereabouts(
    db: Session,
    operator: Profile,
    *,
    kind: str,
    destination_key: str,
    student_id: str | None,
    custom_name: str | None,
    custom_destination: str | None,
    task_name: str | None,
) -> WhereaboutsEntry:
    authz.require_permission(db, operator, pk.ATTENDANCE_MANAGE_ALL)
    if kind not in {"bathroom", "errand"}:
        raise HTTPException(status_code=400, detail="Invalid whereabouts type.")
    if destination_key not in VALID_DESTINATIONS:
        raise HTTPException(status_code=400, detail="Invalid destination.")
    profile: Profile | None = None
    if student_id:
        profile = find_profile_by_student_id(db, student_id)
    if kind == "bathroom" and profile is None:
        raise HTTPException(
            status_code=400, detail="Bathroom checkout requires a student ID."
        )
    display_name = (
        (profile.full_name or profile.email) if profile else (custom_name or "").strip()
    )
    if not display_name:
        raise HTTPException(status_code=400, detail="An errand name is required.")
    if profile is not None:
        active = db.scalar(
            select(WhereaboutsEntry).where(
                WhereaboutsEntry.profile_id == profile.id,
                WhereaboutsEntry.returned_at.is_(None),
            )
        )
        if active is not None:
            raise HTTPException(status_code=409, detail="Student is already checked out.")
    entry = WhereaboutsEntry(
        id=uuid.uuid4(),
        profile_id=profile.id if profile else None,
        display_name=display_name,
        kind=kind,
        destination_key=destination_key,
        custom_destination=(custom_destination or "").strip() or None,
        task_name=(task_name or "").strip() or None,
        left_at=now_utc(),
        initiated_by=operator.id,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def return_whereabouts(
    db: Session, operator: Profile, entry_id: uuid.UUID
) -> WhereaboutsEntry:
    authz.require_permission(db, operator, pk.ATTENDANCE_MANAGE_ALL)
    entry = db.get(WhereaboutsEntry, entry_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Whereabouts entry not found.")
    if entry.returned_at is not None:
        raise HTTPException(status_code=409, detail="Student is already back.")
    entry.returned_at = now_utc()
    db.commit()
    db.refresh(entry)
    return entry


def _visible_profile_ids(db: Session, viewer: Profile) -> set[uuid.UUID] | None:
    if authz.has_permission(db, viewer, pk.ATTENDANCE_VIEW_ALL):
        return None
    committee_ids = [
        membership.committee_id
        for membership in viewer.committee_memberships
        if membership.is_head
        and authz.has_permission(
            db,
            viewer,
            pk.ATTENDANCE_VIEW_COMMITTEE,
            committee_id=membership.committee_id,
        )
    ]
    if not committee_ids:
        raise HTTPException(status_code=403, detail="Attendance map access denied.")
    return set(
        db.scalars(
            select(CommitteeMembership.user_id).where(
                CommitteeMembership.committee_id.in_(committee_ids)
            )
        ).all()
    )


def active_whereabouts(db: Session, viewer: Profile) -> list[WhereaboutsEntry]:
    visible_ids = _visible_profile_ids(db, viewer)
    query = (
        select(WhereaboutsEntry)
        .where(WhereaboutsEntry.returned_at.is_(None))
        .options(selectinload(WhereaboutsEntry.profile))
        .order_by(WhereaboutsEntry.left_at)
    )
    if visible_ids is not None:
        query = query.where(WhereaboutsEntry.profile_id.in_(visible_ids))
    return list(db.scalars(query).all())


def ping_whereabouts(
    db: Session,
    sender: Profile,
    entry_id: uuid.UUID,
    *,
    message: str,
) -> tuple[WhereaboutsPing, str | None]:
    visible = {entry.id: entry for entry in active_whereabouts(db, sender)}
    entry = visible.get(entry_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Active whereabouts entry not found.")
    cleaned = message.strip()
    if not cleaned:
        raise HTTPException(status_code=400, detail="Ping message is required.")
    channel = "in_app"
    phone: str | None = None
    if entry.profile_id is not None:
        deliver(
            db,
            recipient_ids=[entry.profile_id],
            type="whereabouts.ping",
            title="Mr. Jan or a committee head needs you",
            body=cleaned,
            payload={"whereaboutsEntryId": str(entry.id)},
        )
        profile = entry.profile or db.get(Profile, entry.profile_id)
        if profile and profile.phone_verified:
            phone = profile.phone
            channel = "in_app+sms_handoff"
    ping = WhereaboutsPing(
        id=uuid.uuid4(),
        entry_id=entry.id,
        created_by=sender.id,
        message=cleaned,
        channel=channel,
        delivery_status="delivered_in_app" if entry.profile_id else "logged",
    )
    db.add(ping)
    db.commit()
    db.refresh(ping)
    return ping, phone
