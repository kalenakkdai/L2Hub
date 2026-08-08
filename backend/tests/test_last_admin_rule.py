"""The last-administrator rule.

Removing the final AC or President would leave the Campsite with nobody able
to administer it and no way back in through the UI, so the rule lives in a
trigger on user_roles rather than in a form handler.

This is tested two ways:

* Structurally, against the migration SQL. Fast, always runs, and fails if
  someone deletes the trigger or narrows it to only cover DELETE.
* Behaviourally, against a real Postgres. Skipped unless L2HUB_PG_TEST_URL
  points at a database that can be freely written to — the project's normal
  test database is SQLite, which has neither triggers of this kind nor the
  schema, and the Supabase project is shared and must not be used as a
  scratch pad.
"""

import os
import re
import uuid
from pathlib import Path

import pytest

MIGRATION = (
    Path(__file__).resolve().parents[2]
    / "supabase"
    / "migrations"
    / "20260809000000_settings.sql"
)

SUPERADMIN_SLUGS = ("ac", "president")


@pytest.fixture(scope="module")
def migration_sql() -> str:
    assert MIGRATION.exists(), f"Missing migration: {MIGRATION}"
    return MIGRATION.read_text()


class TestRuleIsInstalled:
    """The guarantee is present in the schema, not just in the UI."""

    def test_guard_function_exists(self, migration_sql: str) -> None:
        assert "function public.prevent_last_admin_removal()" in migration_sql

    def test_guard_covers_deletes(self, migration_sql: str) -> None:
        assert re.search(
            r"create trigger user_roles_prevent_last_admin\s+before delete on public\.user_roles",
            migration_sql,
        ), "The last-admin rule must fire before a role assignment is deleted"

    def test_guard_covers_expiry(self, migration_sql: str) -> None:
        # Setting ends_at in the past removes the administrator just as surely
        # as deleting the row, so it has to be covered too.
        assert re.search(
            r"create trigger user_roles_prevent_last_admin_expiry\s+before update on public\.user_roles",
            migration_sql,
        ), "Expiring the last admin's assignment must be blocked as well as deleting it"

    @pytest.mark.parametrize("slug", SUPERADMIN_SLUGS)
    def test_guard_recognises_both_superadmin_roles(
        self, migration_sql: str, slug: str
    ) -> None:
        assert f"'{slug}'" in migration_sql

    def test_guard_ignores_expired_assignments_when_counting(
        self, migration_sql: str
    ) -> None:
        # An assignment that has already lapsed is not a remaining admin.
        assert "ur.ends_at is null or ur.ends_at > now()" in migration_sql

    def test_guard_raises_rather_than_silently_allowing(self, migration_sql: str) -> None:
        assert "raise exception" in migration_sql
        assert "Cannot remove the last administrator" in migration_sql

    def test_guard_runs_as_definer_with_pinned_search_path(
        self, migration_sql: str
    ) -> None:
        # security definer without a pinned search_path is the classic
        # Postgres privilege-escalation footgun.
        block = migration_sql.split("function public.prevent_last_admin_removal()")[1]
        block = block.split("$$;")[0]
        assert "security definer" in block
        assert "set search_path = ''" in block


# ---------------------------------------------------------------------------
# Behavioural tests
# ---------------------------------------------------------------------------

PG_URL = os.environ.get("L2HUB_PG_TEST_URL")

pytestmark_pg = pytest.mark.skipif(
    not PG_URL,
    reason="Set L2HUB_PG_TEST_URL to a disposable Postgres to run the behavioural tests",
)


@pytest.fixture
def pg_connection():
    """A connection wrapped in a transaction that is always rolled back."""
    from sqlalchemy import create_engine

    engine = create_engine(PG_URL or "", future=True)
    connection = engine.connect()
    transaction = connection.begin()
    try:
        yield connection
    finally:
        transaction.rollback()
        connection.close()
        engine.dispose()


def _make_admin(connection, slug: str = "ac") -> uuid.UUID:
    """Creates an auth user, profile, and superadmin assignment."""
    from sqlalchemy import text

    user_id = uuid.uuid4()
    email = f"{user_id}@example.test"

    connection.execute(
        text(
            "insert into auth.users (id, email, aud, role) "
            "values (:id, :email, 'authenticated', 'authenticated')"
        ),
        {"id": user_id, "email": email},
    )
    connection.execute(
        text(
            "insert into public.profiles (id, email, status) "
            "values (:id, :email, 'active') on conflict (id) do nothing"
        ),
        {"id": user_id, "email": email},
    )
    connection.execute(
        text(
            "insert into public.user_roles (user_id, role_id) "
            "select :id, r.id from public.roles r where r.slug = :slug"
        ),
        {"id": user_id, "slug": slug},
    )
    return user_id


@pytestmark_pg
class TestRuleBehaviour:
    def test_removing_the_only_admin_is_refused(self, pg_connection) -> None:
        from sqlalchemy import text
        from sqlalchemy.exc import DBAPIError

        # Clear the field so exactly one superadmin remains.
        pg_connection.execute(
            text(
                "delete from public.user_roles ur using public.roles r "
                "where r.id = ur.role_id and r.slug in ('ac', 'president')"
            )
        )
        admin_id = _make_admin(pg_connection)

        with pytest.raises(DBAPIError, match="last administrator"):
            pg_connection.execute(
                text("delete from public.user_roles where user_id = :id"),
                {"id": admin_id},
            )

    def test_removing_one_of_two_admins_is_allowed(self, pg_connection) -> None:
        from sqlalchemy import text

        first = _make_admin(pg_connection, "ac")
        _make_admin(pg_connection, "president")

        pg_connection.execute(
            text("delete from public.user_roles where user_id = :id"), {"id": first}
        )

        remaining = pg_connection.execute(
            text(
                "select count(distinct ur.user_id) from public.user_roles ur "
                "join public.roles r on r.id = ur.role_id "
                "where r.slug in ('ac', 'president')"
            )
        ).scalar()
        assert remaining >= 1

    def test_expiring_the_only_admin_is_refused(self, pg_connection) -> None:
        from sqlalchemy import text
        from sqlalchemy.exc import DBAPIError

        pg_connection.execute(
            text(
                "delete from public.user_roles ur using public.roles r "
                "where r.id = ur.role_id and r.slug in ('ac', 'president')"
            )
        )
        admin_id = _make_admin(pg_connection)

        # Backdating ends_at is removal by another name.
        with pytest.raises(DBAPIError, match="last administrator"):
            pg_connection.execute(
                text(
                    "update public.user_roles set ends_at = now() - interval '1 day' "
                    "where user_id = :id"
                ),
                {"id": admin_id},
            )

    def test_removing_a_non_admin_role_is_unaffected(self, pg_connection) -> None:
        from sqlalchemy import text

        _make_admin(pg_connection, "ac")
        member_id = _make_admin(pg_connection, "member")

        pg_connection.execute(
            text("delete from public.user_roles where user_id = :id"), {"id": member_id}
        )

        left = pg_connection.execute(
            text("select count(*) from public.user_roles where user_id = :id"),
            {"id": member_id},
        ).scalar()
        assert left == 0
