"""Unit tests for permission resolution, hierarchy, and scopes."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select

from app.core import permission_keys as pk
from app.core.permission_keys import ALL_PERMISSION_KEYS, FEEDBACK_PERMISSIONS
from app.core.role_catalog import ROLE_AC, ROLE_ASBO, ROLE_COMMITTEE_HEAD, ROLE_MEMBER
from app.db.seed import SEED_COMMITTEE_IDS, seed_development_users
from app.models import Permission, PermissionOverride, Role, UserRoleAssignment
from app.services import authorization as authz
from app.services.dashboard import resolve_dashboard_modules


@pytest.fixture
def seeded(db_session):
    return seed_development_users(db_session)


def test_ac_has_superadmin_permissions_except_legacy_grade_edit(db_session, seeded):
    """Jan keeps org-wide keys including full gradebook control with Jadon."""
    ctx = authz.build_auth_context(db_session, seeded["ac"])
    assert FEEDBACK_PERMISSIONS <= ctx.permissions
    assert pk.GRADES_EDIT not in ctx.permissions
    assert pk.GRADES_ASSIGN in ctx.permissions
    assert pk.GRADES_PUBLISH in ctx.permissions
    assert pk.GRADES_VIEW_ALL in ctx.permissions
    assert pk.GRADES_GRADE_COMMITTEE in ctx.permissions
    # Jan is also an attendance operator.
    assert pk.ATTENDANCE_MANAGE_ALL in ctx.permissions
    stripped = {pk.GRADES_EDIT}
    assert (ALL_PERMISSION_KEYS - stripped) <= ctx.permissions


def test_asbo_can_view_all_grades_but_not_edit_or_feedback(db_session, seeded):
    asbo = seeded["asbo"]
    assert authz.has_permission(db_session, asbo, pk.GRADES_VIEW_ALL)
    assert not authz.has_permission(db_session, asbo, pk.GRADES_EDIT)
    assert not authz.has_permission(db_session, asbo, pk.GRADES_ASSIGN)
    assert not authz.has_permission(db_session, asbo, pk.GRADES_PUBLISH)
    assert not authz.has_permission(db_session, asbo, pk.GRADES_GRADE_COMMITTEE)
    assert not authz.has_permission(db_session, asbo, pk.FEEDBACK_VIEW_PRIVATE)
    assert not authz.has_permission(db_session, asbo, pk.FEEDBACK_VIEW_ANONYMOUS)
    assert not authz.has_permission(db_session, asbo, pk.FEEDBACK_MANAGE)
    assert authz.has_permission(db_session, asbo, pk.WRAPPED_REQUEST)
    assert not authz.has_permission(db_session, asbo, pk.WRAPPED_APPROVE)
    assert not authz.has_permission(db_session, asbo, pk.WRAPPED_PUBLISH)
    # Campers roster is visible; invite/sync stays AC-only.
    assert authz.has_permission(db_session, asbo, pk.USERS_VIEW)
    assert not authz.has_permission(db_session, asbo, pk.USERS_MANAGE)


def test_asbo_and_president_can_enable_event_planning(db_session, seeded):
    assert authz.has_permission(db_session, seeded["asbo"], pk.PLANNING_ENABLE)
    # President (Jadon) already has the full AC bundle.
    assert authz.has_permission(db_session, seeded["president"], pk.PLANNING_ENABLE)


def test_president_and_jan_share_full_gradebook_control(db_session, seeded):
    president = seeded["president"]
    ac = seeded["ac"]
    for key in (
        pk.WRAPPED_APPROVE,
        pk.WRAPPED_GENERATE,
        pk.WRAPPED_PUBLISH,
        pk.GRADES_ASSIGN,
        pk.GRADES_PUBLISH,
        pk.GRADES_VIEW_ALL,
        pk.FEEDBACK_VIEW_PRIVATE,
        pk.AGENDA_GENERATE,
    ):
        assert authz.has_permission(db_session, president, key)
        assert authz.has_permission(db_session, ac, key)
    # Both operators may enter scores org-wide (empty committee scope).
    community = SEED_COMMITTEE_IDS["community"]
    spirit = SEED_COMMITTEE_IDS["spirit"]
    for who in (president, ac):
        assert authz.has_permission(
            db_session, who, pk.GRADES_GRADE_COMMITTEE, committee_id=community
        )
        assert authz.has_permission(
            db_session, who, pk.GRADES_GRADE_COMMITTEE, committee_id=spirit
        )
        assert not authz.has_permission(db_session, who, pk.GRADES_EDIT)


def test_committee_head_own_vs_other_committee(db_session, seeded):
    head = seeded["community_head"]
    community = SEED_COMMITTEE_IDS["community"]
    spirit = SEED_COMMITTEE_IDS["spirit"]

    assert authz.has_permission(
        db_session, head, pk.TASKS_VIEW_COMMITTEE, committee_id=community
    )
    assert authz.has_permission(
        db_session, head, pk.TASKS_MANAGE_COMMITTEE, committee_id=community
    )
    assert not authz.has_permission(
        db_session, head, pk.TASKS_VIEW_COMMITTEE, committee_id=spirit
    )
    assert not authz.has_permission(
        db_session, head, pk.TASKS_MANAGE_COMMITTEE, committee_id=spirit
    )


def test_committee_head_can_grade_own_committee_but_not_publish(
    db_session, seeded
):
    head = seeded["community_head"]
    community = SEED_COMMITTEE_IDS["community"]
    spirit = SEED_COMMITTEE_IDS["spirit"]

    assert authz.has_permission(
        db_session, head, pk.GRADES_VIEW_COMMITTEE, committee_id=community
    )
    assert authz.has_permission(
        db_session, head, pk.GRADES_GRADE_COMMITTEE, committee_id=community
    )
    assert not authz.has_permission(
        db_session, head, pk.GRADES_GRADE_COMMITTEE, committee_id=spirit
    )
    assert not authz.has_permission(db_session, head, pk.GRADES_VIEW_ALL)
    assert not authz.has_permission(db_session, head, pk.GRADES_ASSIGN)
    assert not authz.has_permission(db_session, head, pk.GRADES_PUBLISH)
    assert not authz.has_permission(db_session, head, pk.GRADES_EDIT)
    assert not authz.has_permission(db_session, head, pk.FEEDBACK_VIEW_PRIVATE)


def test_jan_and_jadon_share_full_gradebook_control(db_session, seeded):
    jan = seeded["ac"]
    jadon = seeded["president"]
    for who in (jan, jadon):
        assert authz.has_permission(db_session, who, pk.GRADES_ASSIGN)
        assert authz.has_permission(db_session, who, pk.GRADES_PUBLISH)
        assert authz.has_permission(db_session, who, pk.GRADES_VIEW_ALL)
        assert authz.has_permission(
            db_session,
            who,
            pk.GRADES_GRADE_COMMITTEE,
            committee_id=SEED_COMMITTEE_IDS["community"],
        )
        assert not authz.has_permission(db_session, who, pk.GRADES_EDIT)


def test_member_own_grades_only(db_session, seeded):
    member = seeded["community_member"]
    other = seeded["spirit_member"]
    assert authz.has_permission(
        db_session, member, pk.GRADES_VIEW_OWN, resource_owner_id=member.id
    )
    assert not authz.has_permission(
        db_session, member, pk.GRADES_VIEW_OWN, resource_owner_id=other.id
    )
    assert not authz.has_permission(db_session, member, pk.GRADES_VIEW_ALL)


def test_member_can_submit_debrief_but_not_start(db_session, seeded):
    member = seeded["community_member"]
    assert authz.has_permission(db_session, member, pk.DEBRIEF_SUBMIT)
    assert not authz.has_permission(db_session, member, pk.DEBRIEF_START)
    assert not authz.has_permission(db_session, member, pk.TASKS_MANAGE_COMMITTEE)


def test_multiple_roles_combine(db_session, seeded):
    head = seeded["community_head"]
    ctx = authz.build_auth_context(db_session, head)
    slugs = {role["slug"] for role in ctx.roles}
    assert ROLE_MEMBER in slugs
    assert ROLE_COMMITTEE_HEAD in slugs
    assert pk.GRADES_VIEW_OWN in ctx.permissions
    assert pk.TASKS_MANAGE_COMMITTEE in ctx.permissions


def test_explicit_deny_overrides_allow(db_session, seeded):
    asbo = seeded["asbo"]
    permission = db_session.scalar(
        select(Permission).where(Permission.key == pk.GRADES_VIEW_ALL)
    )
    assert permission is not None
    db_session.add(
        PermissionOverride(
            user_id=asbo.id,
            permission_id=permission.id,
            effect="deny",
            reason="temporary suspension",
        )
    )
    db_session.commit()
    db_session.refresh(asbo)
    assert not authz.has_permission(db_session, asbo, pk.GRADES_VIEW_ALL)


def test_asbo_cannot_assign_ac(db_session, seeded):
    asbo = seeded["asbo"]
    ac_role = db_session.scalar(select(Role).where(Role.slug == ROLE_AC))
    assert ac_role is not None
    assert not authz.can_assign_role(db_session, asbo, ac_role)


def test_asbo_cannot_assign_any_role(db_session, seeded):
    asbo = seeded["asbo"]
    member_role = db_session.scalar(select(Role).where(Role.slug == ROLE_MEMBER))
    assert member_role is not None
    assert not authz.has_permission(db_session, asbo, pk.ROLES_ASSIGN)
    assert not authz.can_assign_role(db_session, asbo, member_role)


def test_committee_head_cannot_assign_asbo(db_session, seeded):
    head = seeded["community_head"]
    asbo_role = db_session.scalar(select(Role).where(Role.slug == ROLE_ASBO))
    assert asbo_role is not None
    assert not authz.can_assign_role(db_session, head, asbo_role)


def test_expired_scoped_role_stops_access(db_session, seeded):
    head = seeded["community_head"]
    community = SEED_COMMITTEE_IDS["community"]
    assignment = db_session.scalars(
        select(UserRoleAssignment).where(
            UserRoleAssignment.user_id == head.id,
            UserRoleAssignment.committee_id == community,
        )
    ).first()
    assert assignment is not None
    assignment.ends_at = datetime.now(UTC) - timedelta(minutes=1)
    db_session.commit()
    db_session.refresh(head)
    assert not authz.has_permission(
        db_session, head, pk.TASKS_MANAGE_COMMITTEE, committee_id=community
    )


def test_dashboard_modules_hide_feedback_for_asbo(db_session, seeded):
    modules = {m["key"] for m in resolve_dashboard_modules(db_session, seeded["asbo"])}
    assert "gradebook" in modules
    assert "grade_publish_queue" not in modules
    assert "feedback_review" not in modules
    assert "system_settings" not in modules

    ac_modules = {m["key"] for m in resolve_dashboard_modules(db_session, seeded["ac"])}
    assert "feedback_review" in ac_modules
    assert "system_settings" in ac_modules
    assert "grade_publish_queue" in ac_modules
    assert "committee_grading" in ac_modules

    head_modules = {
        m["key"] for m in resolve_dashboard_modules(db_session, seeded["community_head"])
    }
    assert "committee_grading" in head_modules
    assert "grade_publish_queue" not in head_modules

    member_modules = {
        m["key"] for m in resolve_dashboard_modules(db_session, seeded["community_member"])
    }
    assert "my_grades" in member_modules
    assert "gradebook" not in member_modules
    assert "user_management" not in member_modules
