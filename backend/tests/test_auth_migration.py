"""Contract checks for the normalized Supabase authentication migration.

Postgres applies the SQL in hosted environments; these tests keep critical
security declarations from being accidentally removed in SQLite-only CI.
"""

from pathlib import Path

import pytest

from app.services import authorization as authz

MIGRATION = (
    Path(__file__).resolve().parents[2]
    / "supabase"
    / "migrations"
    / "20260807020000_normalize_auth_and_rls.sql"
)

APPLICATION_TABLES = {
    "profiles",
    "roles",
    "permissions",
    "role_permissions",
    "user_roles",
    "committees",
    "committee_memberships",
    "events",
    "permission_overrides",
    "audit_logs",
    "event_summaries",
    "event_summary_requests",
    "event_agendas",
    "notifications",
    "debrief_participants",
}

REQUIRED_AUTH_POLICIES = {
    "profiles_select_authorized",
    "profiles_update_authorized",
    "roles_select_authenticated",
    "permissions_select_authenticated",
    "user_roles_select_authorized",
    "user_roles_insert_authorized",
    "user_roles_update_authorized",
    "user_roles_delete_authorized",
    "committees_select_authorized",
    "committees_insert_authorized",
    "committees_update_authorized",
    "committees_delete_authorized",
    "committee_memberships_select_authorized",
    "committee_memberships_insert_authorized",
    "committee_memberships_update_authorized",
    "committee_memberships_delete_authorized",
    "events_select_authorized",
    "events_insert_authorized",
    "events_update_authorized",
    "events_delete_authorized",
}


@pytest.fixture(scope="module")
def migration_sql() -> str:
    return MIGRATION.read_text()


def test_migration_removes_profile_enum_role(migration_sql):
    assert "alter table public.profiles drop column if exists role;" in migration_sql
    assert "drop type if exists public.user_role;" in migration_sql


def test_migration_seeds_only_the_five_canonical_role_slugs(migration_sql):
    role_seed = migration_sql.split(
        "insert into public.roles", maxsplit=1
    )[1].split("on conflict (slug)", maxsplit=1)[0]
    for slug in ("ac", "president", "asbo", "committee_head", "member"):
        assert f"'{slug}'" in role_seed
    for obsolete in ("'student'", "'officer'", "'adviser'"):
        assert obsolete not in role_seed


def test_signup_trigger_assigns_member_and_ignores_role_metadata(migration_sql):
    function = migration_sql.split(
        "create or replace function public.handle_new_user()", maxsplit=1
    )[1].split("create trigger on_auth_user_created", maxsplit=1)[0]
    assert "where slug = 'member'" in function
    assert "insert into public.profiles" in function
    assert "insert into public.user_roles" in function
    assert "raw_user_meta_data ->> 'role'" not in function


@pytest.mark.parametrize("table", sorted(APPLICATION_TABLES))
def test_rls_is_enabled_on_every_application_table(migration_sql, table):
    assert f"alter table public.{table} enable row level security;" in migration_sql


def test_anonymous_role_has_no_application_table_privileges(migration_sql):
    assert "revoke all on all tables in schema public from anon;" in migration_sql


@pytest.mark.parametrize("policy", sorted(REQUIRED_AUTH_POLICIES))
def test_required_auth_policy_exists(migration_sql, policy):
    assert f"create policy {policy}" in migration_sql


def test_assignment_and_profile_integrity_triggers_exist(migration_sql):
    for trigger in (
        "profiles_protect_managed_fields",
        "user_roles_protect_assignment",
        "roles_protect_system",
    ):
        assert f"create trigger {trigger}" in migration_sql


def test_seeded_profiles_have_member_baseline_and_normalized_primary_role(
    db_session,
):
    from app.db.seed import seed_development_users

    users = seed_development_users(db_session)

    # Class advisors are deliberately view-only: they never receive the Member
    # baseline, so exclude them from that invariant.
    advisor_keys = {
        "senior_advisor_1",
        "senior_advisor_2",
        "junior_advisor_1",
        "junior_advisor_2",
    }
    primary_by_key = {
        "community_head": "committee_head",
        "spirit_head": "committee_head",
        "community_member": "member",
        "spirit_member": "member",
        "senior_advisor_1": "class_advisor",
        "senior_advisor_2": "class_advisor",
        "junior_advisor_1": "class_advisor",
        "junior_advisor_2": "class_advisor",
        "senior_class_officer": "class_officer",
        "junior_class_officer": "class_officer",
    }

    for expected, profile in users.items():
        context = authz.build_auth_context(db_session, profile)
        role_slugs = {role["slug"] for role in context.roles}
        if expected not in advisor_keys:
            assert "member" in role_slugs
        expected_primary = primary_by_key.get(expected, expected)
        assert authz.primary_role_slug(context) == expected_primary
