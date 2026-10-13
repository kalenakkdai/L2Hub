"""Class Officers workspaces: one fundraiser and one homecoming plan per cohort.

SCO and JCO never share a row. Platform ops (ASBO, AC, President) may open
either cohort. Everyone else is limited to the cohort their account resolves to.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import permission_keys as pk
from app.models import ClassOfficerWorkspace, Profile, Role, UserRoleAssignment
from app.services import authorization as authz
from app.services.class_cohort import (
    ClassCohort,
    platform_may_switch_cohort,
    resolve_class_cohort,
    roster_officers,
)

_COHORTS = ("senior", "junior")


def parse_cohort(value: str) -> ClassCohort:
    if value not in _COHORTS:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Class workspace not found.",
        )
    return value  # type: ignore[return-value]


def _require_cohort(db: Session, profile: Profile, cohort: ClassCohort, *, manage: bool) -> None:
    key = pk.CLASS_OFFICERS_MANAGE if manage else pk.CLASS_OFFICERS_VIEW
    authz.require_permission(db, profile, key)
    if platform_may_switch_cohort(db, profile):
        return
    if resolve_class_cohort(db, profile) != cohort:
        raise authz.permission_denied(
            code="class_cohort_denied",
            message="This class workspace is not yours.",
        )


def _milestones(target_cents: int) -> list[int]:
    dollars = max(target_cents, 0) // 100
    if dollars <= 0:
        return []
    marks = list(range(1000, dollars + 1, 1000))
    if not marks or marks[-1] != dollars:
        marks.append(dollars)
    return marks


def _now() -> datetime:
    return datetime.now(UTC)


def default_fundraiser(cohort: ClassCohort, now: datetime) -> dict:
    senior = cohort == "senior"
    target = 800_000 if senior else 600_000
    who = "Senior" if senior else "Junior"
    return {
        "id": f"fund-{cohort}-winter-prom",
        "label": f"{who} class Winter Ball / Prom fundraising",
        "notes": f"{who} Class Officers only. Aim for at least ${target // 100:,} revenue.",
        "targetCents": target,
        "raisedCents": 0,
        "milestones": _milestones(target),
        "updatedAt": now.isoformat(),
    }


def default_homecoming(cohort: ClassCohort, now: datetime) -> dict:
    return {
        "id": f"hoco-{cohort}-{now.year}",
        "year": now.year,
        "skitTheme": "",
        "skitScript": "",
        "skitScriptUrl": None,
        "skitActors": [],
        "airbands": [],
        "actors": [],
        "stageCrew": [],
        "cleanupCrew": [],
        "checkpoints": [],
        "updatedAt": now.isoformat(),
    }


def _workspace(db: Session, cohort: ClassCohort) -> ClassOfficerWorkspace:
    row = db.get(ClassOfficerWorkspace, cohort)
    if row is not None:
        return row
    now = _now()
    row = ClassOfficerWorkspace(
        cohort=cohort,
        fundraiser_json=json.dumps(default_fundraiser(cohort, now)),
        homecoming_json=json.dumps(default_homecoming(cohort, now)),
        updated_at=now,
    )
    db.add(row)
    db.commit()
    return row


def _load(raw: str, fallback: dict) -> dict:
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return fallback
    if not isinstance(parsed, dict):
        return fallback
    return parsed


def _people_with_role(db: Session, slug: str) -> list[Profile]:
    return list(
        db.scalars(
            select(Profile)
            .join(UserRoleAssignment, UserRoleAssignment.user_id == Profile.id)
            .join(Role, Role.id == UserRoleAssignment.role_id)
            .where(Role.slug == slug)
        ).all()
    )


def _officers(db: Session, cohort: ClassCohort) -> list[dict]:
    rows: list[dict] = []
    seen: set[str] = set()
    for profile in _people_with_role(db, "class_officer"):
        if resolve_class_cohort(db, profile) != cohort:
            continue
        email = (profile.email or "").strip().lower()
        if email:
            seen.add(email)
        person = next(
            (item for item in roster_officers(cohort) if item.email.lower() == email),
            None,
        )
        rows.append(
            {
                "id": str(profile.id),
                "name": profile.display_name or profile.full_name or profile.email,
                "cohort": cohort,
                "title": person.notes if person and person.notes else None,
            }
        )
    for person in roster_officers(cohort):
        if person.email.lower() in seen:
            continue
        rows.append(
            {
                "id": person.email,
                "name": person.name,
                "cohort": cohort,
                "title": person.notes,
            }
        )
    rows.sort(key=lambda row: str(row["name"]).casefold())
    return rows


def _advisors(db: Session, cohort: ClassCohort) -> list[dict]:
    rows = []
    for profile in _people_with_role(db, "class_advisor"):
        if resolve_class_cohort(db, profile) != cohort:
            continue
        rows.append(
            {
                "id": str(profile.id),
                "name": profile.display_name or profile.full_name or profile.email,
                "cohort": cohort,
            }
        )
    rows.sort(key=lambda row: str(row["name"]).casefold())
    return rows


def snapshot(db: Session, profile: Profile, cohort: ClassCohort) -> dict:
    _require_cohort(db, profile, cohort, manage=False)
    row = _workspace(db, cohort)
    now = row.updated_at or _now()
    fundraiser = _load(row.fundraiser_json, default_fundraiser(cohort, now))
    fundraiser["milestones"] = _milestones(int(fundraiser.get("targetCents") or 0))
    homecoming = _load(row.homecoming_json, default_homecoming(cohort, now))
    return {
        "cohort": cohort,
        "fundraiser": fundraiser,
        "homecoming": homecoming,
        "advisors": _advisors(db, cohort),
        "officers": _officers(db, cohort),
    }


def _reject(message: str) -> None:
    raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=message)


def _clean_text(value: str, *, limit: int, field: str) -> str:
    text = value.strip()
    if len(text) > limit:
        _reject(f"{field} is too long.")
    return text


def update_fundraiser(db: Session, profile: Profile, cohort: ClassCohort, patch: dict) -> dict:
    _require_cohort(db, profile, cohort, manage=True)
    row = _workspace(db, cohort)
    now = _now()
    goal = _load(row.fundraiser_json, default_fundraiser(cohort, now))
    if "label" in patch:
        label = _clean_text(str(patch["label"]), limit=200, field="Label")
        if not label:
            _reject("The fundraiser needs a label.")
        goal["label"] = label
    if "notes" in patch:
        goal["notes"] = _clean_text(str(patch["notes"]), limit=4000, field="Notes")
    if "targetCents" in patch:
        target = int(patch["targetCents"])
        if target <= 0:
            _reject("Target must be positive.")
        goal["targetCents"] = target
    if "raisedCents" in patch:
        raised = int(patch["raisedCents"])
        if raised < 0:
            _reject("Raised amount cannot be negative.")
        goal["raisedCents"] = raised
    goal["milestones"] = _milestones(int(goal.get("targetCents") or 0))
    goal["updatedAt"] = now.isoformat()
    row.fundraiser_json = json.dumps(goal)
    row.updated_at = now
    db.commit()
    return goal


def _people(items: list[dict]) -> list[dict]:
    if len(items) > 80:
        _reject("Too many people.")
    cleaned = []
    for item in items:
        name = _clean_text(str(item.get("name") or ""), limit=120, field="Name")
        if not name:
            _reject("A person needs a name.")
        note = item.get("note")
        note_text = None
        if note:
            note_text = _clean_text(str(note), limit=200, field="Note") or None
        person_id = _clean_text(str(item.get("id") or name), limit=200, field="Id")
        cleaned.append({"id": person_id, "name": name, "note": note_text})
    return cleaned


def _airbands(items: list[dict]) -> list[dict]:
    if len(items) > 40:
        _reject("Too many airbands.")
    cleaned = []
    for item in items:
        members = item.get("members") or []
        if not isinstance(members, list) or len(members) > 40:
            _reject("An airband has too many members.")
        cleaned.append(
            {
                "id": _clean_text(str(item.get("id") or "air"), limit=80, field="Id"),
                "groupName": _clean_text(
                    str(item.get("groupName") or "Airband"), limit=120, field="Group"
                ),
                "song": _clean_text(str(item.get("song") or "TBD"), limit=200, field="Song"),
                "members": [
                    _clean_text(str(name), limit=120, field="Member")
                    for name in members
                    if str(name).strip()
                ],
            }
        )
    return cleaned


def _checkpoints(items: list[dict]) -> list[dict]:
    if len(items) > 40:
        _reject("Too many checkpoints.")
    cleaned = []
    for item in items:
        state = str(item.get("status") or "upcoming")
        if state not in {"upcoming", "done", "missed"}:
            _reject("Checkpoint status must be upcoming, done, or missed.")
        date = str(item.get("date") or "")
        if len(date) > 40:
            _reject("Checkpoint date is not usable.")
        cleaned.append(
            {
                "id": _clean_text(str(item.get("id") or "cp"), limit=80, field="Id"),
                "date": date,
                "title": _clean_text(
                    str(item.get("title") or "Checkpoint"), limit=200, field="Title"
                ),
                "detail": _clean_text(str(item.get("detail") or ""), limit=500, field="Detail"),
                "status": state,
            }
        )
    return cleaned


_HOMECOMING_LISTS = {
    "skitActors": _people,
    "actors": _people,
    "stageCrew": _people,
    "cleanupCrew": _people,
    "airbands": _airbands,
    "checkpoints": _checkpoints,
}


def update_homecoming(db: Session, profile: Profile, cohort: ClassCohort, patch: dict) -> dict:
    _require_cohort(db, profile, cohort, manage=True)
    row = _workspace(db, cohort)
    now = _now()
    plan = _load(row.homecoming_json, default_homecoming(cohort, now))
    if "skitTheme" in patch:
        plan["skitTheme"] = _clean_text(str(patch["skitTheme"]), limit=200, field="Theme")
    if "skitScript" in patch:
        plan["skitScript"] = _clean_text(str(patch["skitScript"]), limit=20000, field="Script")
    if "skitScriptUrl" in patch:
        url = patch["skitScriptUrl"]
        plan["skitScriptUrl"] = (
            _clean_text(str(url), limit=500, field="Script URL") if url else None
        )
    for key, cleaner in _HOMECOMING_LISTS.items():
        if key in patch:
            value = patch[key]
            if not isinstance(value, list):
                _reject(f"{key} must be a list.")
            plan[key] = cleaner(value)
    plan["updatedAt"] = now.isoformat()
    row.homecoming_json = json.dumps(plan)
    row.updated_at = now
    db.commit()
    return plan
