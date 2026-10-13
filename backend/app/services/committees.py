"""Committee rosters — who is in a committee, for pickers and member lists."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from app.core import permission_keys as pk
from app.db.l2_roster import L2_ROSTER_COMMITTEES
from app.models import Committee, CommitteeMembership, Event, Profile, Task
from app.services import authorization as authz
from app.services import work


def _position(membership: CommitteeMembership) -> str | None:
    """The label under a camper's name, or nothing at all.

    Returning "Member" would hang a meaningless badge on most of the roster,
    so an ordinary membership has no position rather than a filler one.
    """
    if membership.is_head:
        return "Head"
    if membership.membership_type and membership.membership_type != "member":
        return membership.membership_type.replace("_", " ").title()
    return None


def member_payload(membership: CommitteeMembership) -> dict:
    profile = membership.user
    return {
        "id": str(profile.id),
        # A roster is exactly where a chosen display name should win; the
        # task serializer's `_person` only knows full_name because it labels
        # records rather than introducing people.
        "name": profile.display_name or profile.full_name or profile.email,
        "position": _position(membership),
        "isHead": membership.is_head,
        "avatarUrl": profile.avatar_url,
    }


def roster_payload(db: Session, committee: Committee) -> dict:
    """Everyone in `committee`, heads first then alphabetical.

    camelCase, matching board_payload and task_payload. The sibling
    /committees/{ref}/tasks endpoint returns snake_case keys; that is the
    outlier in this area and not worth propagating into a new response.
    """
    memberships = db.scalars(
        select(CommitteeMembership)
        .options(selectinload(CommitteeMembership.user))
        .join(Profile, Profile.id == CommitteeMembership.user_id)
        .where(CommitteeMembership.committee_id == committee.id)
        .order_by(CommitteeMembership.is_head.desc(), Profile.full_name)
    ).all()
    return {
        "committeeId": str(committee.id),
        "committeeSlug": committee.slug,
        "committeeName": committee.name,
        "members": [member_payload(m) for m in memberships if m.user is not None],
    }


_TASK_STATUS_LABELS = {
    "todo": "To do",
    "doing": "In progress",
    "done": "Done",
}

_ROSTER_SLUGS = [slug for slug, *_rest in L2_ROSTER_COMMITTEES]
_CONTACT_EMAILS = {slug: email for slug, _name, email, _heads, _members in L2_ROSTER_COMMITTEES}


def prepare_directory(db: Session) -> None:
    """Make sure the twelve Leadership 2 committees exist before listing them."""
    from app.services.campers import ensure_roster_committees

    counts = ensure_roster_committees(db)
    if counts["committees_created"] or counts["committees_updated"]:
        db.commit()


def _memberships(db: Session, committee_ids: list[uuid.UUID]) -> list[CommitteeMembership]:
    if not committee_ids:
        return []
    return list(
        db.scalars(
            select(CommitteeMembership)
            .options(selectinload(CommitteeMembership.user))
            .where(CommitteeMembership.committee_id.in_(committee_ids))
        ).all()
    )


def _summary(
    committee: Committee,
    memberships: list[CommitteeMembership],
    mine: set[uuid.UUID],
) -> dict:
    heads = [
        member_payload(m)["name"]
        for m in memberships
        if m.user is not None and m.is_head
    ]
    heads.sort(key=str.casefold)
    people = {m.user_id for m in memberships if m.user is not None}
    return {
        "id": committee.slug,
        "name": committee.name,
        "head": ", ".join(heads) if heads else None,
        "email": _CONTACT_EMAILS.get(committee.slug),
        "camperCount": len(people),
        "isMine": committee.id in mine,
    }


def _task_meta(task: Task) -> str:
    parts: list[str] = []
    if task.due_on is not None:
        parts.append(f"Due {task.due_on.strftime('%b')} {task.due_on.day}")
    assignee = task.assignee
    if assignee is not None:
        name = assignee.display_name or assignee.full_name or assignee.email
        parts.append(f"assigned to {name}")
    else:
        parts.append("unassigned")
    return " · ".join(parts)


def _task_row(task: Task) -> dict:
    return {
        "id": str(task.id),
        "title": task.title,
        "meta": _task_meta(task),
        "status": _TASK_STATUS_LABELS.get(task.status, task.status.replace("_", " ").title()),
    }


def _event_row(event: Event) -> dict:
    return {
        "id": str(event.id),
        "startsAt": event.starts_at.isoformat() if event.starts_at else None,
        "title": event.name,
        "detail": event.location or event.status.replace("_", " "),
    }


def directory_payload(db: Session, profile: Profile) -> dict:
    """The committees index: the twelve Leadership 2 camps, not legacy extras."""
    authz.require_permission(db, profile, pk.COMMITTEES_VIEW)
    prepare_directory(db)
    by_slug = {
        committee.slug: committee
        for committee in db.scalars(select(Committee)).all()
        if committee.slug in _CONTACT_EMAILS
    }
    ordered = [by_slug[slug] for slug in _ROSTER_SLUGS if slug in by_slug]
    grouped: dict[uuid.UUID, list[CommitteeMembership]] = {
        committee.id: [] for committee in ordered
    }
    for membership in _memberships(db, [committee.id for committee in ordered]):
        grouped.setdefault(membership.committee_id, []).append(membership)
    mine = work.member_committee_ids(profile)
    committees = [_summary(committee, grouped[committee.id], mine) for committee in ordered]
    campers = {
        membership.user_id
        for rows in grouped.values()
        for membership in rows
        if membership.user is not None
    }
    return {"camperTotal": len(campers), "committees": committees}


def directory_detail(db: Session, profile: Profile, committee: Committee) -> dict:
    """One committee's roster, open work, and events it manages."""
    authz.require_permission(db, profile, pk.COMMITTEES_VIEW)
    memberships = _memberships(db, [committee.id])
    memberships.sort(
        key=lambda m: (
            not m.is_head,
            (m.user.full_name or m.user.email or "").casefold() if m.user else "",
        )
    )
    summary = _summary(committee, memberships, work.member_committee_ids(profile))
    members = [member_payload(m) for m in memberships if m.user is not None]
    tasks = db.scalars(
        select(Task)
        .options(selectinload(Task.assignee))
        .where(Task.committee_id == committee.id)
        .order_by(Task.due_on.is_(None), Task.due_on, Task.created_at)
    ).all()
    now = datetime.now(UTC)
    events = db.scalars(
        select(Event)
        .where(Event.managing_committee_id == committee.id)
        .where(Event.starts_at.is_not(None))
        .where(or_(Event.starts_at >= now, Event.ends_at >= now))
        .order_by(Event.starts_at)
    ).all()
    return {
        **summary,
        "members": [
            {
                "id": member["id"],
                "name": member["name"],
                "position": member["position"],
                "isHead": member["isHead"],
            }
            for member in members
        ],
        "remainingCount": 0,
        "tasks": [_task_row(task) for task in tasks],
        "events": [_event_row(event) for event in events],
    }
