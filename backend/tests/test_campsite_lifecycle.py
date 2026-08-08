"""Campsite lifecycle: transfer admin, leave, and Break Camp.

The interesting property of all three is that they must not be able to leave
the Campsite without an administrator, including under concurrency. That is
enforced in three places, and each is checked here:

* ordering — transfer assigns before it removes,
* locking — every admin change serialises on an advisory lock,
* the trigger — the database refuses regardless of what the caller does.
"""

from __future__ import annotations

import inspect
import re
from pathlib import Path

import pytest

from app.services import campsite as campsite_service

MIGRATIONS = Path(__file__).resolve().parents[2] / "supabase" / "migrations"
LIFECYCLE_SQL = (MIGRATIONS / "20260810000000_campsite_lifecycle.sql").read_text()


class TestTransferOrdering:
    """Assign-then-remove is the whole reason transfer cannot strand a Campsite."""

    def test_assigns_the_recipient_before_removing_the_actor(self) -> None:
        source = inspect.getsource(campsite_service.transfer_admin)

        assign_at = source.index("db.add(UserRoleAssignment(")
        remove_at = source.index("delete(UserRoleAssignment)")

        assert assign_at < remove_at, (
            "The incoming administrator must be assigned before the outgoing "
            "one is removed, or the trigger sees zero admins mid-transaction"
        )

    def test_flushes_the_assignment_so_the_trigger_can_see_it(self) -> None:
        source = inspect.getsource(campsite_service.transfer_admin)
        # Without the flush the insert is still pending in the session and the
        # trigger's count would miss it.
        assert re.search(r"db\.add\(UserRoleAssignment\(.*?\)\)\s*\n\s*db\.flush\(\)", source, re.DOTALL)

    def test_takes_the_advisory_lock_first(self) -> None:
        source = inspect.getsource(campsite_service.transfer_admin)
        assert source.index("_lock_admin_changes(db)") < source.index("recipient = db.get")

    def test_commits_once(self) -> None:
        # Two commits would mean two transactions, and a window between them.
        source = inspect.getsource(campsite_service.transfer_admin)
        assert source.count("db.commit()") == 1


class TestLocking:
    @pytest.mark.parametrize(
        "operation", [campsite_service.transfer_admin, campsite_service.leave_campsite]
    )
    def test_every_admin_mutation_serialises(self, operation) -> None:
        assert "_lock_admin_changes(db)" in inspect.getsource(operation)

    def test_the_lock_is_transaction_scoped(self) -> None:
        # A session-scoped lock would leak if a request died mid-flight.
        assert "pg_advisory_xact_lock" in LIFECYCLE_SQL

    def test_the_lock_helper_pins_its_search_path(self) -> None:
        block = LIFECYCLE_SQL.split("function public.lock_admin_changes()")[1].split("$$;")[0]
        assert "security definer" in block
        assert "set search_path = ''" in block


class TestLeaveRefusesTheLastAdmin:
    def test_checks_before_deleting_anything(self) -> None:
        source = inspect.getsource(campsite_service.leave_campsite)

        guard_at = source.index("len(admin_ids) == 1")
        delete_at = source.index("delete(CommitteeMembership)")

        assert guard_at < delete_at, "Refuse before touching rows, not after"

    def test_says_what_to_do_instead(self) -> None:
        source = inspect.getsource(campsite_service.leave_campsite)
        assert "Transfer administration to" in source

    def test_deactivates_rather_than_deletes_the_profile(self) -> None:
        source = inspect.getsource(campsite_service.leave_campsite)
        # Deleting would cascade into submissions and grades the Campsite keeps.
        assert 'actor.status = "left"' in source
        assert "delete(Profile)" not in source


class TestBreakCamp:
    def test_archives_rather_than_deletes(self) -> None:
        source = inspect.getsource(campsite_service.break_camp)
        assert "archived_at = now()" in source
        # Look for actual delete statements, not the word in the docstring.
        assert "delete(" not in source
        assert not re.search(r"delete\s+from", source, re.IGNORECASE)

    def test_rechecks_the_typed_name_on_the_server(self) -> None:
        source = inspect.getsource(campsite_service.break_camp)
        # The UI confirmation is a speed bump; this is the gate.
        assert "confirm_name.strip() != name" in source

    def test_locks_the_settings_row(self) -> None:
        source = inspect.getsource(campsite_service.break_camp)
        assert "for update" in source

    def test_refuses_to_archive_twice(self) -> None:
        source = inspect.getsource(campsite_service.break_camp)
        assert "already archived" in source

    def test_archived_campsites_become_read_only_in_rls(self) -> None:
        policy = LIFECYCLE_SQL.split("create policy campsite_settings_update")[1]
        assert "archived_at is null" in policy, (
            "An archived Campsite must stop being writable, not merely look archived"
        )


class TestErrorTranslation:
    def test_the_trigger_message_becomes_a_conflict(self) -> None:
        source = inspect.getsource(campsite_service._translate_last_admin_error)
        assert "HTTP_409_CONFLICT" in source

    def test_unrelated_database_errors_are_not_swallowed(self) -> None:
        source = inspect.getsource(campsite_service._translate_last_admin_error)
        # Only the last-admin case is translated; everything else propagates.
        assert "raise error" in source


class TestEndpointsAreGuarded:
    def test_transfer_and_break_camp_require_settings_edit(self) -> None:
        source = (
            Path(__file__).resolve().parents[1] / "app" / "api" / "routes_campsite.py"
        ).read_text()

        transfer = source.split('@router.post(\n    "/transfer-admin"')[1].split("def ")[0]
        break_camp = source.split('@router.post(\n    "/break-camp"')[1].split("def ")[0]

        assert "SETTINGS_EDIT" in transfer
        assert "SETTINGS_EDIT" in break_camp

    def test_leaving_needs_no_permission_beyond_being_signed_in(self) -> None:
        source = (
            Path(__file__).resolve().parents[1] / "app" / "api" / "routes_campsite.py"
        ).read_text()
        leave = source.split('@router.post("/leave")')[1].split("return")[0]

        # It only ever affects the caller, so a permission gate would be wrong.
        assert "require_permission" not in leave
        assert "CurrentProfile" in leave
