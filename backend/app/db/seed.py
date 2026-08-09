"""Seed roles, permissions, committees, and development users."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.permission_keys import PERMISSION_CATALOG
from app.core.role_catalog import ROLE_PERMISSION_BUNDLES, SYSTEM_ROLES
from app.models import (
    Committee,
    CommitteeMembership,
    DebriefParticipant,
    Event,
    EventSummary,
    Permission,
    Role,
    RolePermission,
    UserRoleAssignment,
)
from app.models.profile import Profile

# Stable IDs so tests and docs can refer to the same fixtures.
SEED_COMMITTEE_IDS = {
    "community": uuid.UUID("11111111-1111-4111-8111-111111111111"),
    "spirit": uuid.UUID("22222222-2222-4222-8222-222222222222"),
    "activities": uuid.UUID("12121212-1212-4121-8121-121212121212"),
    "elections": uuid.UUID("13131313-1313-4131-8131-131313131313"),
    "fundraising": uuid.UUID("14141414-1414-4141-8141-141414141414"),
    "gtac": uuid.UUID("15151515-1515-4151-8151-151515151515"),
    "hcmc": uuid.UUID("16161616-1616-4161-8161-161616161616"),
    "publicity": uuid.UUID("17171717-1717-4171-8171-171717171717"),
    "student_store": uuid.UUID("18181818-1818-4181-8181-181818181818"),
    "star": uuid.UUID("19191919-1919-4191-8191-191919191919"),
    "sports": uuid.UUID("1a1a1a1a-1a1a-41a1-81a1-1a1a1a1a1a1a"),
    "tech": uuid.UUID("1b1b1b1b-1b1b-41b1-81b1-1b1b1b1b1b1b"),
    "videography_photography": uuid.UUID(
        "1c1c1c1c-1c1c-41c1-81c1-1c1c1c1c1c1c"
    ),
}

# Display names for the twelve Leadership 2 committees, plus the legacy Spirit
# committee still referenced by Fall Rally seed events.
SEED_COMMITTEES: tuple[tuple[str, str], ...] = (
    ("activities", "Activities"),
    ("community", "Community"),
    ("elections", "Elections"),
    ("fundraising", "Fundraising"),
    ("gtac", "GTAC"),
    ("hcmc", "HCMC"),
    ("publicity", "Publicity"),
    ("student_store", "Student Store"),
    ("star", "STAR"),
    ("sports", "Sports"),
    ("tech", "Tech"),
    ("videography_photography", "Videography/Photography"),
    ("spirit", "Spirit"),
)

SEED_USER_IDS = {
    "ac": uuid.UUID("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
    "president": uuid.UUID("99999999-9999-4999-8999-999999999999"),
    "asbo": uuid.UUID("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"),
    "community_head": uuid.UUID("cccccccc-cccc-4ccc-8ccc-cccccccccccc"),
    "spirit_head": uuid.UUID("dddddddd-dddd-4ddd-8ddd-dddddddddddd"),
    "community_member": uuid.UUID("eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"),
    "spirit_member": uuid.UUID("ffffffff-ffff-4fff-8fff-ffffffffffff"),
    "senior_advisor_1": uuid.UUID("a1111111-a111-4111-8111-111111111111"),
    "senior_advisor_2": uuid.UUID("a2222222-a222-4222-8222-222222222222"),
    "junior_advisor_1": uuid.UUID("a3333333-a333-4333-8333-333333333333"),
    "junior_advisor_2": uuid.UUID("a4444444-a444-4444-8444-444444444444"),
    "senior_class_officer": uuid.UUID("b1111111-b111-4111-8111-111111111111"),
    "junior_class_officer": uuid.UUID("b2222222-b222-4222-8222-222222222222"),
}


def seed_permissions_and_roles(db: Session) -> dict[str, Role]:
    from sqlalchemy.orm import selectinload

    permissions: dict[str, Permission] = {}
    for key, description, category in PERMISSION_CATALOG:
        existing = db.scalar(select(Permission).where(Permission.key == key))
        if existing:
            permissions[key] = existing
            continue
        perm = Permission(key=key, description=description, category=category)
        db.add(perm)
        permissions[key] = perm
    db.flush()

    roles: dict[str, Role] = {}
    for name, slug, rank, is_assignable in SYSTEM_ROLES:
        role = db.scalar(
            select(Role)
            .where(Role.slug == slug)
            .options(
                selectinload(Role.permissions).selectinload(RolePermission.permission)
            )
        )
        if role is None:
            role = Role(
                name=name,
                slug=slug,
                rank=rank,
                is_system=True,
                is_assignable=is_assignable,
            )
            db.add(role)
            db.flush()
        else:
            role.name = name
            role.rank = rank
            role.is_system = True
            role.is_assignable = is_assignable
        roles[slug] = role

        wanted = ROLE_PERMISSION_BUNDLES[slug]
        existing_keys = {
            link.permission.key for link in role.permissions if link.permission is not None
        }
        for key in wanted - existing_keys:
            db.add(
                RolePermission(
                    role_id=role.id,
                    permission_id=permissions[key].id,
                    effect="allow",
                )
            )
        for link in list(role.permissions):
            if link.permission is not None and link.permission.key not in wanted:
                db.delete(link)

    db.flush()
    return roles


def seed_committees(db: Session) -> dict[str, Committee]:
    result: dict[str, Committee] = {}
    for slug, name in SEED_COMMITTEES:
        committee = db.scalar(select(Committee).where(Committee.slug == slug))
        if committee is None:
            committee = Committee(
                id=SEED_COMMITTEE_IDS[slug],
                slug=slug,
                name=name,
            )
            db.add(committee)
        else:
            committee.name = name
        result[slug] = committee
    db.flush()
    return result


def _ensure_user(
    db: Session,
    *,
    user_id: uuid.UUID,
    email: str,
    full_name: str,
) -> Profile:
    user = db.get(Profile, user_id)
    if user is None:
        user = Profile(
            id=user_id,
            email=email,
            full_name=full_name,
            status="active",
            last_active_at=datetime.now(UTC),
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
        db.add(user)
        db.flush()
    else:
        user.email = email
        user.full_name = full_name
        user.status = "active"
    return user


def _assign_role(
    db: Session,
    *,
    user: Profile,
    role: Role,
    committee: Committee | None = None,
) -> None:
    existing = db.scalars(
        select(UserRoleAssignment).where(
            UserRoleAssignment.user_id == user.id,
            UserRoleAssignment.role_id == role.id,
            UserRoleAssignment.committee_id == (committee.id if committee else None),
        )
    ).first()
    if existing:
        return
    db.add(
        UserRoleAssignment(
            user_id=user.id,
            role_id=role.id,
            committee_id=committee.id if committee else None,
        )
    )


def _ensure_membership(
    db: Session,
    *,
    user: Profile,
    committee: Committee,
    is_head: bool,
) -> None:
    existing = db.scalars(
        select(CommitteeMembership).where(
            CommitteeMembership.user_id == user.id,
            CommitteeMembership.committee_id == committee.id,
        )
    ).first()
    if existing:
        existing.is_head = is_head
        existing.membership_type = "head" if is_head else "member"
        return
    db.add(
        CommitteeMembership(
            user_id=user.id,
            committee_id=committee.id,
            membership_type="head" if is_head else "member",
            is_head=is_head,
        )
    )


SEED_EVENT_IDS = {
    "maze_2025": uuid.UUID("33333333-3333-4333-8333-333333333333"),
    "maze_2026": uuid.UUID("44444444-4444-4444-8444-444444444444"),
    "fall_rally_2026": uuid.UUID("55555555-5555-4555-8555-555555555555"),
}


def seed_events(db: Session, committees: dict[str, Committee]) -> dict[str, Event]:
    result: dict[str, Event] = {}
    specs = (
        (
            "maze_2025",
            "Maze Day",
            "maze-day-2025",
            2025,
            "complete",
            committees["community"].id,
            None,
            None,
        ),
        (
            "maze_2026",
            "Maze Day",
            "maze-day-2026",
            2026,
            "complete",
            committees["community"].id,
            None,
            None,
        ),
        (
            "fall_rally_2026",
            "Fall Rally",
            "event-plan-4c7953f5fc2853429cfac21324fafd5d",
            2026,
            "active",
            committees["spirit"].id,
            datetime(2026, 9, 12, tzinfo=UTC),
            datetime(2026, 9, 13, tzinfo=UTC),
        ),
    )
    for key, name, slug, year, status, committee_id, starts_at, ends_at in specs:
        event = db.get(Event, SEED_EVENT_IDS[key])
        if event is None:
            event = Event(
                id=SEED_EVENT_IDS[key],
                name=name,
                slug=slug,
                year=year,
                status=status,
                managing_committee_id=committee_id,
                starts_at=starts_at,
                ends_at=ends_at,
            )
            db.add(event)
            db.flush()
            db.add(EventSummary(event_id=event.id, status="not_requested"))
        result[key] = event

    maze = result["maze_2026"]
    existing = db.scalars(
        select(DebriefParticipant).where(DebriefParticipant.event_id == maze.id)
    ).first()
    if existing is None:
        participants = [
            ("Avery Chen", "submitted", SEED_USER_IDS["community_member"]),
            ("Sam Ortiz", "submitted", SEED_USER_IDS["spirit_member"]),
            ("Jordan Lee", "submitted", SEED_USER_IDS["community_head"]),
            ("Riley Park", "writing", SEED_USER_IDS["spirit_head"]),
            ("Taylor Kim", "submitted", SEED_USER_IDS["asbo"]),
            ("Guest Leader", "absent", None),
            ("Station Lead A", "not_started", None),
            ("Station Lead B", "submitted", None),
        ]
        for name, status, user_id in participants:
            db.add(
                DebriefParticipant(
                    event_id=maze.id,
                    user_id=user_id,
                    display_name=name,
                    status=status,
                    submitted_at=datetime.now(UTC) if status == "submitted" else None,
                )
            )
    db.flush()
    return result


def seed_development_users(db: Session) -> dict[str, Profile]:
    roles = seed_permissions_and_roles(db)
    committees = seed_committees(db)
    seed_events(db, committees)

    ac = _ensure_user(
        db,
        user_id=SEED_USER_IDS["ac"],
        email="ac@l2hub.local",
        full_name="Mr. Jan",
    )
    president = _ensure_user(
        db,
        user_id=SEED_USER_IDS["president"],
        email="president@l2hub.local",
        full_name="Brittany Lu",
    )
    asbo = _ensure_user(
        db,
        user_id=SEED_USER_IDS["asbo"],
        email="asbo@l2hub.local",
        full_name="Taylor Kim",
    )
    community_head = _ensure_user(
        db,
        user_id=SEED_USER_IDS["community_head"],
        email="community.head@l2hub.local",
        full_name="Jordan Lee",
    )
    spirit_head = _ensure_user(
        db,
        user_id=SEED_USER_IDS["spirit_head"],
        email="spirit.head@l2hub.local",
        full_name="Riley Park",
    )
    community_member = _ensure_user(
        db,
        user_id=SEED_USER_IDS["community_member"],
        email="community.member@l2hub.local",
        full_name="Avery Chen",
    )
    spirit_member = _ensure_user(
        db,
        user_id=SEED_USER_IDS["spirit_member"],
        email="spirit.member@l2hub.local",
        full_name="Sam Ortiz",
    )
    senior_advisor_1 = _ensure_user(
        db,
        user_id=SEED_USER_IDS["senior_advisor_1"],
        email="senior.advisor1@l2hub.local",
        full_name="Pat Rivera",
    )
    senior_advisor_2 = _ensure_user(
        db,
        user_id=SEED_USER_IDS["senior_advisor_2"],
        email="senior.advisor2@l2hub.local",
        full_name="Casey Ng",
    )
    junior_advisor_1 = _ensure_user(
        db,
        user_id=SEED_USER_IDS["junior_advisor_1"],
        email="junior.advisor1@l2hub.local",
        full_name="Morgan Ellis",
    )
    junior_advisor_2 = _ensure_user(
        db,
        user_id=SEED_USER_IDS["junior_advisor_2"],
        email="junior.advisor2@l2hub.local",
        full_name="Jamie Soto",
    )
    senior_class_officer = _ensure_user(
        db,
        user_id=SEED_USER_IDS["senior_class_officer"],
        email="sco@l2hub.local",
        full_name="Alex Kim",
    )
    junior_class_officer = _ensure_user(
        db,
        user_id=SEED_USER_IDS["junior_class_officer"],
        email="jco@l2hub.local",
        full_name="Jamie Park",
    )

    # Supabase's signup trigger assigns Member to every account. Local seed
    # users mirror that baseline before receiving elevated roles.
    for user in (
        ac,
        president,
        asbo,
        community_head,
        spirit_head,
        community_member,
        spirit_member,
        senior_class_officer,
        junior_class_officer,
    ):
        _assign_role(db, user=user, role=roles["member"])

    # Class advisors intentionally do not receive the Member baseline — their
    # only job on the platform is watching Class Officers progress.
    for advisor in (
        senior_advisor_1,
        senior_advisor_2,
        junior_advisor_1,
        junior_advisor_2,
    ):
        _assign_role(db, user=advisor, role=roles["class_advisor"])

    _assign_role(db, user=ac, role=roles["ac"])
    _assign_role(db, user=president, role=roles["president"])
    _assign_role(db, user=asbo, role=roles["asbo"])
    _assign_role(db, user=senior_class_officer, role=roles["class_officer"])
    _assign_role(db, user=junior_class_officer, role=roles["class_officer"])

    _assign_role(
        db,
        user=community_head,
        role=roles["committee_head"],
        committee=committees["community"],
    )
    _ensure_membership(
        db, user=community_head, committee=committees["community"], is_head=True
    )

    _assign_role(
        db,
        user=spirit_head,
        role=roles["committee_head"],
        committee=committees["spirit"],
    )
    _ensure_membership(db, user=spirit_head, committee=committees["spirit"], is_head=True)

    _ensure_membership(
        db, user=community_member, committee=committees["community"], is_head=False
    )

    _ensure_membership(
        db, user=spirit_member, committee=committees["spirit"], is_head=False
    )

    db.commit()
    return {
        "ac": ac,
        "president": president,
        "asbo": asbo,
        "community_head": community_head,
        "spirit_head": spirit_head,
        "community_member": community_member,
        "spirit_member": spirit_member,
        "senior_advisor_1": senior_advisor_1,
        "senior_advisor_2": senior_advisor_2,
        "junior_advisor_1": junior_advisor_1,
        "junior_advisor_2": junior_advisor_2,
        "senior_class_officer": senior_class_officer,
        "junior_class_officer": junior_class_officer,
    }


def ensure_catalog(db: Session) -> None:
    """Idempotent catalog seed used by app startup and tests."""
    seed_permissions_and_roles(db)
    committees = seed_committees(db)
    seed_events(db, committees)
    db.commit()
