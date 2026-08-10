"""Enroll attendance student IDs from the roster mapping file.

Student IDs are matched to profiles by email (preferred) or normalized name.
This is independent of Auth passwords — changing a password never touches the
attendance digest.
"""

from __future__ import annotations

import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.l2_roster import L2_ROSTER_PEOPLE
from app.models.attendance import AttendanceIdentity
from app.models.profile import Profile
from app.services import attendance
from app.services.campers import normalize_person_name
from app.services.roster_ids import STUDENT_IDS_PATH, load_student_ids, student_id_for_person

logger = logging.getLogger(__name__)


def sync_roster_student_ids(db: Session) -> dict[str, int | bool]:
    """Upsert AttendanceIdentity digests for every roster person we can match."""
    ids = load_student_ids()
    if not ids:
        logger.info(
            "No student ID file at %s — skipping attendance enrollment sync",
            STUDENT_IDS_PATH,
        )
        return {
            "enrolled": 0,
            "updated": 0,
            "skipped": 0,
            "missing_file": True,
        }

    profiles = list(db.scalars(select(Profile)).all())
    by_email = {(p.email or "").strip().lower(): p for p in profiles if p.email}
    by_name = {
        normalize_person_name(p.full_name or ""): p
        for p in profiles
        if normalize_person_name(p.full_name or "")
    }

    enrolled = 0
    updated = 0
    skipped = 0

    for person in L2_ROSTER_PEOPLE:
        raw_id = student_id_for_person(
            email=person.email, name=person.name, ids=ids
        )
        if not raw_id:
            skipped += 1
            continue

        profile = by_email.get(person.email.lower()) or by_name.get(
            normalize_person_name(person.name)
        )
        if profile is None:
            skipped += 1
            continue

        existing = db.get(AttendanceIdentity, profile.id)
        before = existing.student_id_digest if existing else None
        try:
            attendance.apply_identity(
                db,
                profile_id=profile.id,
                student_id=raw_id,
                commit=False,
            )
        except Exception:
            logger.exception(
                "Failed to enroll student ID for %s (%s)", person.name, person.email
            )
            skipped += 1
            continue

        after = db.get(AttendanceIdentity, profile.id)
        if before is None:
            enrolled += 1
        elif after is not None and after.student_id_digest != before:
            updated += 1

    db.commit()
    return {
        "enrolled": enrolled,
        "updated": updated,
        "skipped": skipped,
        "missing_file": False,
    }
