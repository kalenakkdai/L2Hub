"""Senior (SCO) vs Junior (JCO) Class Officers cohort resolution.

Same UI surface; data must never cross cohorts. Cohort is derived from the
Leadership 2 roster (SCO*/JCO* notes) or known seed/advisor emails — not from
the browser.
"""

from __future__ import annotations

import re
from typing import Literal

from sqlalchemy.orm import Session

from app.db.l2_roster import L2_ROSTER_PEOPLE, RosterPerson
from app.models import Profile
from app.services import authorization as authz

ClassCohort = Literal["senior", "junior"]

_SCO_RE = re.compile(r"\bSCO\b", re.IGNORECASE)
_JCO_RE = re.compile(r"\bJCO\b", re.IGNORECASE)


def normalize_person_name(name: str) -> str:
    cleaned = re.sub(r"\([^)]*\)", "", name or "")
    return " ".join(cleaned.lower().split())


def cohort_from_notes(notes: str) -> ClassCohort | None:
    text = notes or ""
    if _SCO_RE.search(text):
        return "senior"
    if _JCO_RE.search(text):
        return "junior"
    return None


def cohort_from_roster_person(person: RosterPerson) -> ClassCohort | None:
    return cohort_from_notes(person.notes)


def roster_officers(cohort: ClassCohort) -> list[RosterPerson]:
    return [
        person
        for person in L2_ROSTER_PEOPLE
        if cohort_from_roster_person(person) == cohort
    ]


def _cohort_from_email(email: str) -> ClassCohort | None:
    needle = email.strip().lower()
    if not needle:
        return None
    if (
        needle.startswith("sco@")
        or "senior.advisor" in needle
        or needle.startswith("senior.class")
    ):
        return "senior"
    if (
        needle.startswith("jco@")
        or "junior.advisor" in needle
        or needle.startswith("junior.class")
    ):
        return "junior"
    return None


def _roster_person_for_profile(profile: Profile) -> RosterPerson | None:
    email = (profile.email or "").strip().lower()
    if email:
        for person in L2_ROSTER_PEOPLE:
            if person.email.lower() == email:
                return person
    key = normalize_person_name(profile.full_name or "")
    if not key:
        return None
    for person in L2_ROSTER_PEOPLE:
        if normalize_person_name(person.name) == key:
            return person
    return None


def resolve_class_cohort(db: Session, profile: Profile) -> ClassCohort | None:
    """Which Class Officers workspace this camper belongs to.

    Platform ops (ASBO/AC/President) without an SCO/JCO roster title return
    None — the UI may let them pick a cohort to inspect, but each cohort's
    data stays isolated.
    """
    del db
    from_email = _cohort_from_email(profile.email or "")
    if from_email is not None:
        return from_email
    person = _roster_person_for_profile(profile)
    if person is not None:
        return cohort_from_roster_person(person)
    return None


def platform_may_switch_cohort(db: Session, profile: Profile) -> bool:
    """ASBO/AC/President may open either SCO or JCO workspace.

    Locked SCO/JCO (and class advisors) stay on their own cohort. Platform
    ops always get the Senior/Junior switcher, even if they also sit on a
    committee roster row.
    """
    ctx = authz.build_auth_context(db, profile)
    slug = authz.primary_role_slug(ctx)
    if slug in {"asbo", "ac", "president"}:
        return True
    return any(role["slug"] in {"asbo", "ac", "president"} for role in ctx.roles)
