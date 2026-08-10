"""Merge the Leadership 2 spreadsheet roster with live profiles for Campers."""

from __future__ import annotations

import re
import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.db.l2_roster import L2_ROSTER_PEOPLE
from app.models import Committee, CommitteeMembership, Profile, Role, UserRoleAssignment
from app.schemas.auth import CommitteeSummary, RoleAssignmentOut, UserListItem
from app.services import authorization as authz
from app.services.class_cohort import cohort_from_roster_person

# Stable namespace so awaiting-signup rows keep the same id across requests.
_ROSTER_NS = uuid.UUID("a1b2c3d4-e5f6-4789-a012-3456789abcde")
_EPOCH = datetime(2026, 1, 1, tzinfo=UTC)


def normalize_person_name(name: str) -> str:
    """Compare roster names to profile.full_name without parentheticals/case."""
    cleaned = re.sub(r"\([^)]*\)", "", name or "")
    return " ".join(cleaned.lower().split())


def roster_placeholder_id(name: str) -> uuid.UUID:
    return uuid.uuid5(_ROSTER_NS, normalize_person_name(name))


def _role_payload(assignment: UserRoleAssignment) -> RoleAssignmentOut:
    role = assignment.role
    committee_name = assignment.committee.name if assignment.committee else None
    scope = (
        "committee"
        if assignment.committee_id
        else "event"
        if assignment.event_id
        else "global"
    )
    return RoleAssignmentOut(
        slug=role.slug,
        name=role.name,
        rank=role.rank,
        scope=scope,
        committee_id=str(assignment.committee_id) if assignment.committee_id else None,
        event_id=str(assignment.event_id) if assignment.event_id else None,
        committee_name=committee_name,
    )


def _committee_payload(membership: CommitteeMembership) -> CommitteeSummary:
    return CommitteeSummary(
        id=membership.committee.id,
        slug=membership.committee.slug,
        name=membership.committee.name,
        is_head=membership.is_head,
        membership_type=membership.membership_type,
    )


def _item_from_profile(db: Session, profile: Profile) -> UserListItem:
    roles = [_role_payload(a) for a in profile.role_assignments if a.role is not None]
    committees = [
        _committee_payload(m)
        for m in profile.committee_memberships
        if m.committee is not None
    ]
    primary_role = authz.primary_role_slug(authz.build_auth_context(db, profile))
    return UserListItem(
        id=profile.id,
        email=profile.email,
        full_name=profile.full_name,
        status=profile.status,
        primary_role=primary_role,
        roles=roles,
        committees=committees,
        last_active_at=profile.last_active_at,
        created_at=profile.created_at,
        account_linked=True,
    )


def _pending_item(
    *,
    name: str,
    email: str,
    committee_slug: str,
    committee_name: str,
    committee_id: uuid.UUID | None,
    is_head: bool,
    asbo: bool,
    membership_type: str,
) -> UserListItem:
    committees: list[CommitteeSummary] = []
    if committee_id is not None:
        committees.append(
            CommitteeSummary(
                id=committee_id,
                slug=committee_slug,
                name=committee_name,
                is_head=is_head,
                membership_type=membership_type,
            )
        )
    roles: list[RoleAssignmentOut] = []
    if asbo:
        roles.append(
            RoleAssignmentOut(
                slug="asbo",
                name="ASBO",
                rank=80,
                scope="global",
            )
        )
    elif is_head:
        roles.append(
            RoleAssignmentOut(
                slug="committee_head",
                name="Committee Head",
                rank=50,
                scope="committee",
                committee_id=str(committee_id) if committee_id else None,
                committee_name=committee_name,
            )
        )
    else:
        roles.append(
            RoleAssignmentOut(
                slug="member",
                name="Member",
                rank=10,
                scope="global",
            )
        )
    primary = "asbo" if asbo else "committee_head" if is_head else "member"
    return UserListItem(
        id=roster_placeholder_id(name),
        email=email,
        full_name=name,
        status="awaiting_signup",
        primary_role=primary,
        roles=roles,
        committees=committees,
        last_active_at=None,
        created_at=_EPOCH,
        account_linked=False,
    )


def list_campers(db: Session) -> list[UserListItem]:
    """Full class roster: spreadsheet people first, then extra signed-up accounts."""
    profiles = list(
        db.scalars(
            select(Profile)
            .options(
                selectinload(Profile.role_assignments).selectinload(UserRoleAssignment.role),
                selectinload(Profile.role_assignments).selectinload(
                    UserRoleAssignment.committee
                ),
                selectinload(Profile.committee_memberships).selectinload(
                    CommitteeMembership.committee
                ),
            )
            .order_by(Profile.email.asc())
        ).unique()
    )
    by_name: dict[str, Profile] = {}
    by_email: dict[str, Profile] = {}
    for profile in profiles:
        key = normalize_person_name(profile.full_name or "")
        if key and key not in by_name:
            by_name[key] = profile
        email_key = (profile.email or "").strip().lower()
        if email_key:
            by_email[email_key] = profile

    committees = {
        row.slug: row for row in db.scalars(select(Committee)).all()
    }

    items: list[UserListItem] = []
    seen_profile_ids: set[uuid.UUID] = set()
    seen_pending_names: set[str] = set()

    for person in L2_ROSTER_PEOPLE:
        key = normalize_person_name(person.name)
        if key in seen_pending_names:
            continue
        seen_pending_names.add(key)
        profile = by_email.get(person.email.lower()) or by_name.get(key)
        if profile is not None:
            seen_profile_ids.add(profile.id)
            items.append(_item_from_profile(db, profile))
            continue

        if person.committee_slug is None:
            items.append(
                _pending_item(
                    name=person.name,
                    email=person.email,
                    committee_slug="ta",
                    committee_name="Teacher's Assistant",
                    committee_id=None,
                    is_head=False,
                    asbo=False,
                    membership_type="ta",
                )
            )
            continue

        committee = committees.get(person.committee_slug)
        display = committee.name if committee else person.committee_slug
        membership_type = (
            "head"
            if person.position == "head"
            else "baby"
            if person.position == "baby"
            else "member"
        )
        items.append(
            _pending_item(
                name=person.name,
                email=person.email,
                committee_slug=person.committee_slug,
                committee_name=display,
                committee_id=committee.id if committee else None,
                is_head=person.position == "head",
                asbo=person.is_asbo,
                membership_type=membership_type,
            )
        )

    for profile in profiles:
        if profile.id not in seen_profile_ids:
            items.append(_item_from_profile(db, profile))

    return items


def sync_roster_memberships(db: Session) -> dict[str, int]:
    """Attach signed-up profiles to committees when email or name matches the roster."""
    profiles = list(db.scalars(select(Profile)).all())
    by_name = {
        normalize_person_name(p.full_name or ""): p
        for p in profiles
        if normalize_person_name(p.full_name or "")
    }
    by_email = {(p.email or "").strip().lower(): p for p in profiles if p.email}
    committees = {c.slug: c for c in db.scalars(select(Committee)).all()}
    roles = {r.slug: r for r in db.scalars(select(Role)).all()}
    head_role = roles.get("committee_head")
    asbo_role = roles.get("asbo")
    member_role = roles.get("member")
    class_officer_role = roles.get("class_officer")

    linked = 0
    heads = 0
    asbos = 0
    babies = 0
    class_officers = 0

    for person in L2_ROSTER_PEOPLE:
        profile = by_email.get(person.email.lower()) or by_name.get(
            normalize_person_name(person.name)
        )
        if profile is None:
            continue
        if profile.full_name != person.name:
            profile.full_name = person.name

        if person.is_asbo and asbo_role is not None:
            _ensure_global_role(db, profile.id, asbo_role.id)
            asbos += 1

        if member_role is not None:
            _ensure_global_role(db, profile.id, member_role.id)

        if class_officer_role is not None and cohort_from_roster_person(person) is not None:
            _ensure_global_role(db, profile.id, class_officer_role.id)
            class_officers += 1

        if person.committee_slug is None:
            continue
        committee = committees.get(person.committee_slug)
        if committee is None:
            continue

        is_head = person.position == "head"
        membership_type = (
            "head" if is_head else "baby" if person.position == "baby" else "member"
        )
        if membership_type == "baby":
            babies += 1

        existing = db.scalars(
            select(CommitteeMembership).where(
                CommitteeMembership.user_id == profile.id,
                CommitteeMembership.committee_id == committee.id,
            )
        ).first()
        if existing is None:
            db.add(
                CommitteeMembership(
                    user_id=profile.id,
                    committee_id=committee.id,
                    membership_type=membership_type,
                    is_head=is_head,
                )
            )
            linked += 1
        else:
            existing.is_head = is_head
            existing.membership_type = membership_type

        if is_head and head_role is not None:
            _ensure_scoped_role(db, profile.id, head_role.id, committee.id)
            heads += 1

    db.commit()
    from app.services import roster_student_ids as student_id_sync

    id_sync = student_id_sync.sync_roster_student_ids(db)
    return {
        "memberships_created": linked,
        "heads_marked": heads,
        "asbos_marked": asbos,
        "babies_marked": babies,
        "class_officers_marked": class_officers,
        "student_ids_enrolled": id_sync["enrolled"],
        "student_ids_updated": id_sync["updated"],
        "student_ids_skipped": id_sync["skipped"],
        "student_ids_missing_file": id_sync["missing_file"],
    }


def _ensure_global_role(db: Session, user_id: uuid.UUID, role_id: uuid.UUID) -> None:
    existing = db.scalars(
        select(UserRoleAssignment).where(
            UserRoleAssignment.user_id == user_id,
            UserRoleAssignment.role_id == role_id,
            UserRoleAssignment.committee_id.is_(None),
            UserRoleAssignment.event_id.is_(None),
        )
    ).first()
    if existing is None:
        db.add(UserRoleAssignment(user_id=user_id, role_id=role_id))


def _ensure_scoped_role(
    db: Session, user_id: uuid.UUID, role_id: uuid.UUID, committee_id: uuid.UUID
) -> None:
    existing = db.scalars(
        select(UserRoleAssignment).where(
            UserRoleAssignment.user_id == user_id,
            UserRoleAssignment.role_id == role_id,
            UserRoleAssignment.committee_id == committee_id,
        )
    ).first()
    if existing is None:
        db.add(
            UserRoleAssignment(
                user_id=user_id, role_id=role_id, committee_id=committee_id
            )
        )
