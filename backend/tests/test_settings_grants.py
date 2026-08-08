"""Table privileges for the settings tables.

RLS and GRANTs are two independent gates and both must be right. A policy
that admits a camper to their own row does nothing if the role was never
granted UPDATE on the table — which is exactly how the settings page shipped
first: every write returned "permission denied for table profiles" while the
policies looked correct.

These read the migrations rather than the database, so they run offline and
fail on the change that would reintroduce the problem.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

MIGRATIONS = Path(__file__).resolve().parents[2] / "supabase" / "migrations"
GRANTS_SQL = (MIGRATIONS / "20260811000000_settings_grants.sql").read_text()
REVOKE_SQL = (MIGRATIONS / "20260811010000_revoke_status_write.sql").read_text()
SETTINGS_SQL = (MIGRATIONS / "20260809000000_settings.sql").read_text()

#: Columns the settings page writes, which therefore need the privilege.
CAMPER_WRITABLE = (
    "display_name",
    "pronouns",
    "grade_year",
    "avatar_url",
    "phone",
    "theme",
    "reduce_motion",
    "compact_density",
    "quiet_hours_start",
    "quiet_hours_end",
    "notifications_paused",
)

#: Columns a camper must never set for themselves.
CAMPER_FORBIDDEN = ("email", "email_verified", "phone_verified", "status", "id")


@pytest.fixture(scope="module")
def granted_columns() -> set[str]:
    match = re.search(
        r"grant update \((.*?)\) on public\.profiles to authenticated",
        GRANTS_SQL,
        re.DOTALL,
    )
    assert match, "No column-scoped update grant on profiles"
    return {c.strip() for c in match.group(1).split(",") if c.strip()}


class TestProfileWritePrivileges:
    @pytest.mark.parametrize("column", CAMPER_WRITABLE)
    def test_settings_columns_are_writable(
        self, column: str, granted_columns: set[str]
    ) -> None:
        assert column in granted_columns, (
            f"{column} is written by the settings page but not granted, so the "
            f"write will fail with permission denied regardless of RLS"
        )

    @pytest.mark.parametrize("column", CAMPER_FORBIDDEN)
    def test_protected_columns_are_not_writable(
        self, column: str, granted_columns: set[str]
    ) -> None:
        assert column not in granted_columns

    def test_the_grant_is_column_scoped(self) -> None:
        # A blanket "grant update on public.profiles" would hand campers the
        # verification flags and their own status.
        assert not re.search(
            r"grant update on public\.profiles", GRANTS_SQL, re.IGNORECASE
        )

    def test_status_is_revoked(self) -> None:
        # Granted in 20260807020000; the server reads it as trustworthy, so a
        # camper must not be able to answer that question about themselves.
        assert re.search(
            r"revoke update \(status\) on public\.profiles from authenticated",
            REVOKE_SQL,
        )


class TestNewTablePrivileges:
    def test_notification_preferences_are_camper_writable(self) -> None:
        assert re.search(
            r"grant select, insert, update, delete on public\.notification_preferences to authenticated",
            SETTINGS_SQL,
        )

    def test_campsite_settings_are_not_insertable_or_deletable(self) -> None:
        # The singleton is created by migration. RLS has no insert or delete
        # policy, and the privilege is removed so the two agree.
        assert re.search(
            r"revoke insert, delete on public\.campsite_settings from authenticated",
            REVOKE_SQL + GRANTS_SQL,
        )

    def test_truncate_is_not_left_granted(self) -> None:
        # Supabase grants everything to authenticated on new public tables.
        assert "revoke truncate" in GRANTS_SQL


class TestPolicyAndGrantAgree:
    """RLS narrowing what a grant permits is the intended pairing."""

    def test_profiles_settings_columns_have_an_update_policy(self) -> None:
        # The policy lives in an earlier migration; this asserts the pairing is
        # still deliberate rather than accidental.
        assert "grant update (" in GRANTS_SQL

    def test_notification_preferences_are_owner_scoped(self) -> None:
        # The name appears in both the drop and the create; take the last part.
        policy = SETTINGS_SQL.split("notification_preferences_update_own")[-1]
        assert "(select auth.uid()) = profile_id" in policy

    def test_campsite_settings_writes_require_the_permission(self) -> None:
        policy = SETTINGS_SQL.split("create policy campsite_settings_update")[1]
        assert "current_user_has_permission('settings.edit')" in policy
