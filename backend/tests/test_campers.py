"""Unit tests for Campers roster merge + membership sync."""

from __future__ import annotations

import uuid

from app.db.l2_roster import L2_ROSTER_COMMITTEES
from app.db.seed import seed_committees, seed_development_users, seed_permissions_and_roles
from app.models import Profile
from app.services.campers import list_campers, normalize_person_name, sync_roster_memberships


def test_normalize_strips_parentheticals():
    assert normalize_person_name("Hanna (Yuanting) Cai") == "hanna cai"
    assert normalize_person_name("  Xinyan (Grace) Zeng ") == "xinyan zeng"


def test_list_campers_includes_roster_and_seeded_accounts(db_session):
    seed_development_users(db_session)
    items = list_campers(db_session)
    names = {item.full_name for item in items}
    assert "Hanna Rahmanian" in names
    assert "Samay Jain" in names
    assert "Mr. Jan" in names  # seeded AC not on spreadsheet

    pending = [item for item in items if not item.account_linked]
    assert len(pending) >= 40
    assert all(item.status == "awaiting_signup" for item in pending)

    linked = [item for item in items if item.email == "ac@l2hub.local"]
    assert linked and linked[0].account_linked is True


def test_sync_roster_memberships_links_matching_profile(db_session):
    seed_permissions_and_roles(db_session)
    committees = seed_committees(db_session)
    person = Profile(
        id=uuid.uuid4(),
        email="ariel.duong@example.com",
        full_name="Ariel Duong",
        status="active",
    )
    db_session.add(person)
    db_session.commit()

    result = sync_roster_memberships(db_session)
    assert result["memberships_created"] >= 1

    items = list_campers(db_session)
    ariel = next(item for item in items if item.full_name == "Ariel Duong")
    assert ariel.account_linked is True
    assert any(c.slug == "community" and not c.is_head for c in ariel.committees)
    assert committees["community"].slug == "community"


def test_roster_covers_twelve_committees():
    assert len(L2_ROSTER_COMMITTEES) == 12
