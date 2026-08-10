"""SCO vs JCO cohort resolution and roster role sync."""

from __future__ import annotations

import uuid

from app.db.seed import seed_committees, seed_development_users, seed_permissions_and_roles
from app.models import Profile, Role, UserRoleAssignment
from app.services.class_cohort import (
    cohort_from_notes,
    platform_may_switch_cohort,
    resolve_class_cohort,
    roster_officers,
)
from app.services.campers import sync_roster_memberships
from sqlalchemy import select


def test_notes_map_sco_and_jco():
    assert cohort_from_notes("SCO President") == "senior"
    assert cohort_from_notes("JCO Treasurer") == "junior"
    assert cohort_from_notes("Member") is None


def test_roster_lists_four_officers_each():
    assert len(roster_officers("senior")) == 4
    assert len(roster_officers("junior")) == 4


def test_seed_sco_and_jco_resolve_cohort(db_session):
    users = seed_development_users(db_session)
    assert resolve_class_cohort(db_session, users["senior_class_officer"]) == "senior"
    assert resolve_class_cohort(db_session, users["junior_class_officer"]) == "junior"
    assert resolve_class_cohort(db_session, users["senior_advisor_1"]) == "senior"
    assert resolve_class_cohort(db_session, users["junior_advisor_1"]) == "junior"
    assert resolve_class_cohort(db_session, users["ac"]) is None
    assert platform_may_switch_cohort(db_session, users["ac"]) is True
    assert platform_may_switch_cohort(db_session, users["asbo"]) is True
    assert platform_may_switch_cohort(db_session, users["senior_class_officer"]) is False


def test_auth_me_asbo_can_switch_class_cohort(client, make_token, db_session):
    users = seed_development_users(db_session)
    body = client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {make_token(sub=users['asbo'].id)}"},
    ).json()
    assert "users.view" in body["permissions"]
    assert "users.manage" not in body["permissions"]
    assert body["can_switch_class_cohort"] is True


def test_auth_me_includes_class_cohort(client, make_token, db_session):
    users = seed_development_users(db_session)
    sco = users["senior_class_officer"]
    body = client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {make_token(sub=sco.id)}"},
    ).json()
    assert body["class_cohort"] == "senior"
    assert body["can_switch_class_cohort"] is False

    ac = users["ac"]
    ac_body = client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {make_token(sub=ac.id)}"},
    ).json()
    assert ac_body["class_cohort"] is None
    assert ac_body["can_switch_class_cohort"] is True


def test_sync_assigns_class_officer_for_sco_notes(db_session):
    seed_permissions_and_roles(db_session)
    seed_committees(db_session)
    person = Profile(
        id=uuid.uuid4(),
        email="kvpradyun@gmail.com",
        full_name="Pradyun Kanuparthi",
        status="active",
    )
    db_session.add(person)
    db_session.commit()

    result = sync_roster_memberships(db_session)
    assert result["class_officers_marked"] >= 1

    role = db_session.scalars(select(Role).where(Role.slug == "class_officer")).one()
    assignment = db_session.scalars(
        select(UserRoleAssignment).where(
            UserRoleAssignment.user_id == person.id,
            UserRoleAssignment.role_id == role.id,
        )
    ).first()
    assert assignment is not None
    assert resolve_class_cohort(db_session, person) == "senior"
