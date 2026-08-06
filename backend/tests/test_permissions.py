import uuid

import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app.api import deps
from app.core import permissions
from app.db.session import get_db

ALL_ROLES = ("student", "committee_head", "officer", "adviser")


# ---------------------------------------------------------------------------
# Role hierarchy
# ---------------------------------------------------------------------------


def test_all_four_roles_are_defined():
    assert permissions.ROLE_ORDER == ALL_ROLES


def test_roles_are_ordered_least_to_most_privileged():
    ranks = [permissions.rank(role) for role in ALL_ROLES]
    assert ranks == sorted(ranks)
    assert permissions.rank("student") < permissions.rank("committee_head")
    assert permissions.rank("committee_head") < permissions.rank("officer")
    assert permissions.rank("officer") < permissions.rank("adviser")


@pytest.mark.parametrize("role", ALL_ROLES)
def test_every_role_is_valid(role):
    assert permissions.is_valid_role(role)


@pytest.mark.parametrize("role", ["", "admin", "Student", "committee-head", "teacher"])
def test_unknown_roles_are_invalid(role):
    assert not permissions.is_valid_role(role)
    with pytest.raises(ValueError):
        permissions.rank(role)


def test_has_at_least_is_inclusive_of_the_named_role():
    assert permissions.has_at_least("officer", "officer")
    assert permissions.has_at_least("adviser", "officer")
    assert not permissions.has_at_least("committee_head", "officer")
    assert not permissions.has_at_least("student", "committee_head")
    assert permissions.has_at_least("committee_head", "student")


def test_staff_excludes_students_and_committee_heads():
    assert permissions.is_staff("officer")
    assert permissions.is_staff("adviser")
    assert not permissions.is_staff("committee_head")
    assert not permissions.is_staff("student")


def test_leadership_includes_committee_heads_but_not_students():
    assert permissions.is_leadership("committee_head")
    assert permissions.is_leadership("officer")
    assert permissions.is_leadership("adviser")
    assert not permissions.is_leadership("student")


# ---------------------------------------------------------------------------
# Role gates as FastAPI dependencies
# ---------------------------------------------------------------------------


@pytest.fixture
def gated_app(db_session):
    """A throwaway app exposing one endpoint per gate."""
    app = FastAPI()

    @app.get("/staff-only", dependencies=[Depends(deps.require_staff)])
    def staff_only():
        return {"ok": True}

    @app.get("/leadership-only", dependencies=[Depends(deps.require_leadership)])
    def leadership_only():
        return {"ok": True}

    @app.get("/advisers-only", dependencies=[Depends(deps.require_roles("adviser"))])
    def advisers_only():
        return {"ok": True}

    @app.get("/officer-or-above", dependencies=[Depends(deps.require_min_role("officer"))])
    def officer_or_above():
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
    [("student", 403), ("committee_head", 403), ("officer", 200), ("adviser", 200)],
)
def test_staff_gate(gated_client, make_token, make_profile, role, expected):
    profile = make_profile(user_id=uuid.uuid4(), role=role)
    response = call(gated_client, "/staff-only", make_token(sub=profile.id))
    assert response.status_code == expected


@pytest.mark.parametrize(
    ("role", "expected"),
    [("student", 403), ("committee_head", 200), ("officer", 200), ("adviser", 200)],
)
def test_leadership_gate_admits_committee_heads(
    gated_client, make_token, make_profile, role, expected
):
    profile = make_profile(user_id=uuid.uuid4(), role=role)
    response = call(gated_client, "/leadership-only", make_token(sub=profile.id))
    assert response.status_code == expected


@pytest.mark.parametrize(
    ("role", "expected"),
    [("student", 403), ("committee_head", 403), ("officer", 403), ("adviser", 200)],
)
def test_exact_role_gate(gated_client, make_token, make_profile, role, expected):
    profile = make_profile(user_id=uuid.uuid4(), role=role)
    response = call(gated_client, "/advisers-only", make_token(sub=profile.id))
    assert response.status_code == expected


@pytest.mark.parametrize(
    ("role", "expected"),
    [("student", 403), ("committee_head", 403), ("officer", 200), ("adviser", 200)],
)
def test_minimum_role_gate(gated_client, make_token, make_profile, role, expected):
    profile = make_profile(user_id=uuid.uuid4(), role=role)
    response = call(gated_client, "/officer-or-above", make_token(sub=profile.id))
    assert response.status_code == expected


def test_gates_still_require_authentication(gated_client):
    assert gated_client.get("/staff-only").status_code == 401


def test_unknown_role_in_the_database_fails_closed(gated_client, make_token, make_profile):
    """A role this build doesn't know must not be treated as privileged."""
    profile = make_profile(user_id=uuid.uuid4(), role="superuser")

    assert call(gated_client, "/officer-or-above", make_token(sub=profile.id)).status_code == 403
    assert call(gated_client, "/staff-only", make_token(sub=profile.id)).status_code == 403
