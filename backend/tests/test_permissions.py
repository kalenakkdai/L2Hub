import uuid

import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app.api import deps
from app.core import permissions
from app.db.session import get_db

ALL_ROLES = ("member", "committee_head", "asbo", "ac", "president")


def test_all_system_roles_are_defined():
    assert permissions.ROLE_ORDER == ALL_ROLES


def test_roles_are_ordered_least_to_most_privileged():
    ranks = [permissions.rank(role) for role in ALL_ROLES]
    assert ranks == sorted(ranks)
    assert permissions.rank("member") < permissions.rank("committee_head")
    assert permissions.rank("committee_head") < permissions.rank("asbo")
    assert permissions.rank("asbo") < permissions.rank("ac")
    assert permissions.rank("president") == permissions.rank("ac")


@pytest.mark.parametrize("role", ALL_ROLES)
def test_every_role_is_valid(role):
    assert permissions.is_valid_role(role)


@pytest.mark.parametrize(
    "role",
    ["", "admin", "student", "officer", "adviser", "committee-head", "teacher"],
)
def test_unknown_roles_are_invalid(role):
    assert not permissions.is_valid_role(role)
    with pytest.raises(ValueError):
        permissions.rank(role)


def test_has_at_least_is_inclusive_of_the_named_role():
    assert permissions.has_at_least("asbo", "asbo")
    assert permissions.has_at_least("ac", "asbo")
    assert permissions.has_at_least("president", "asbo")
    assert not permissions.has_at_least("committee_head", "asbo")
    assert not permissions.has_at_least("member", "committee_head")
    assert permissions.has_at_least("committee_head", "member")


def test_staff_excludes_members_and_committee_heads():
    assert permissions.is_staff("asbo")
    assert permissions.is_staff("ac")
    assert permissions.is_staff("president")
    assert not permissions.is_staff("committee_head")
    assert not permissions.is_staff("member")


def test_leadership_includes_committee_heads_but_not_members():
    assert permissions.is_leadership("committee_head")
    assert permissions.is_leadership("asbo")
    assert permissions.is_leadership("ac")
    assert permissions.is_leadership("president")
    assert not permissions.is_leadership("member")


def test_president_is_superadmin_peer_of_ac():
    assert permissions.is_superadmin("president")
    assert permissions.is_superadmin("ac")
    assert not permissions.is_superadmin("asbo")


@pytest.fixture
def gated_app(db_session):
    app = FastAPI()

    @app.get("/staff-only", dependencies=[Depends(deps.require_staff)])
    def staff_only():
        return {"ok": True}

    @app.get("/leadership-only", dependencies=[Depends(deps.require_leadership)])
    def leadership_only():
        return {"ok": True}

    @app.get("/ac-only", dependencies=[Depends(deps.require_roles("ac"))])
    def ac_only():
        return {"ok": True}

    @app.get("/asbo-or-above", dependencies=[Depends(deps.require_min_role("asbo"))])
    def asbo_or_above():
        return {"ok": True}

    app.dependency_overrides[get_db] = lambda: db_session
    return app


@pytest.fixture
def gated_client(gated_app):
    with TestClient(gated_app) as client:
        yield client


def call(client, path, token):
    return client.get(path, headers={"Authorization": f"Bearer {token}"})


@pytest.mark.parametrize(
    ("role", "expected"),
    [
        ("member", 403),
        ("committee_head", 403),
        ("asbo", 200),
        ("ac", 200),
        ("president", 200),
    ],
)
def test_staff_gate(gated_client, make_token, make_profile, role, expected):
    profile = make_profile(user_id=uuid.uuid4(), role=role)
    response = call(gated_client, "/staff-only", make_token(sub=profile.id))
    assert response.status_code == expected


@pytest.mark.parametrize(
    ("role", "expected"),
    [
        ("member", 403),
        ("committee_head", 200),
        ("asbo", 200),
        ("ac", 200),
        ("president", 200),
    ],
)
def test_leadership_gate_admits_committee_heads(
    gated_client, make_token, make_profile, role, expected
):
    profile = make_profile(user_id=uuid.uuid4(), role=role)
    response = call(gated_client, "/leadership-only", make_token(sub=profile.id))
    assert response.status_code == expected


@pytest.mark.parametrize(
    ("role", "expected"),
    [
        ("member", 403),
        ("committee_head", 403),
        ("asbo", 403),
        ("ac", 200),
        ("president", 403),
    ],
)
def test_exact_role_gate(gated_client, make_token, make_profile, role, expected):
    profile = make_profile(user_id=uuid.uuid4(), role=role)
    response = call(gated_client, "/ac-only", make_token(sub=profile.id))
    assert response.status_code == expected


@pytest.mark.parametrize(
    ("role", "expected"),
    [
        ("member", 403),
        ("committee_head", 403),
        ("asbo", 200),
        ("ac", 200),
        ("president", 200),
    ],
)
def test_minimum_role_gate(gated_client, make_token, make_profile, role, expected):
    profile = make_profile(user_id=uuid.uuid4(), role=role)
    response = call(gated_client, "/asbo-or-above", make_token(sub=profile.id))
    assert response.status_code == expected


def test_gates_still_require_authentication(gated_client):
    assert gated_client.get("/staff-only").status_code == 401


def test_unknown_role_in_the_database_fails_closed(gated_client, make_token, make_profile):
    profile = make_profile(user_id=uuid.uuid4(), role="superuser")
    assert call(gated_client, "/asbo-or-above", make_token(sub=profile.id)).status_code == 403
    assert call(gated_client, "/staff-only", make_token(sub=profile.id)).status_code == 403


def test_obsolete_role_names_fail_closed(gated_client, make_token, make_profile):
    profile = make_profile(user_id=uuid.uuid4(), role="obsolete")
    assert call(gated_client, "/staff-only", make_token(sub=profile.id)).status_code == 403
