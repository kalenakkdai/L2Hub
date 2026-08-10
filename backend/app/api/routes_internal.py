"""Endpoints a scheduler calls, not a person.

Kept off the OpenAPI schema and behind a shared secret rather than a bearer
token — see `require_job_secret` for why a JWT is the wrong instrument here.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.api.deps import DbSession, EmailSenderDep, JobAuth
from app.services import activities_calendar_sync, deadlines, planning_reminders

router = APIRouter(prefix="/internal", tags=["internal"], include_in_schema=False)


@router.post("/jobs/deadline-reminders")
def run_deadline_reminders(
    _: JobAuth,
    db: DbSession,
    sender: EmailSenderDep,
) -> dict:
    """Raise today's due-soon and overdue notices.

    Takes no parameters, deliberately. A caller-supplied date would let
    anyone holding the secret send the whole class notices whose wording
    disagrees with reality ("due in 3 days" for something due tomorrow).
    Backfilling is a job for scripts/run_deadline_sweep.py, which needs
    database access rather than a secret.

    Safe to call twice: every notice is keyed, so a repeat run finds the
    keys already there and writes nothing. That matters because pg_net is
    fire-and-forget — a cold start or a 502 makes a successful run look
    failed, and any retry has to be free.

    Returns 200 even when some email failed. The run itself succeeded; the
    counters carry the detail, and failing the whole call would fill
    cron.job_run_details with noise that teaches everyone to ignore it.
    """
    result = deadlines.sweep_deadlines(db, sender=sender)
    return {
        "ok": True,
        "today": result.today.isoformat(),
        "considered": result.considered,
        "dueSoon": result.due_soon_sent,
        "overdue": result.overdue_sent,
        "duplicates": result.duplicates,
        "emailsSent": result.emails_sent,
        "emailsFailed": result.emails_failed,
    }


@router.post("/jobs/sync-activities-calendar")
def run_sync_activities_calendar(_: JobAuth, db: DbSession) -> dict:
    """Upsert the MSJ Activities Calendar into events + iCal."""
    result = activities_calendar_sync.sync_activities_calendar(db)
    db.commit()
    return {
        "ok": True,
        "considered": result.considered,
        "created": result.created,
        "updated": result.updated,
        "planningEvents": result.planning_events,
    }


@router.post("/jobs/planning-reminders")
def run_planning_reminders(_: JobAuth, db: DbSession) -> dict:
    """Notify Mr. Jan three months before each ASB event on the calendar.

    Safe to call twice: notices are deduped per event. Syncs the Activities
    Calendar first so dates stay aligned with the spreadsheet export.
    """
    sync = activities_calendar_sync.sync_activities_calendar(db)
    result = planning_reminders.sweep_planning_reminders(db)
    db.commit()
    return {
        "ok": True,
        "today": result.today.isoformat(),
        "sync": {
            "considered": sync.considered,
            "created": sync.created,
            "updated": sync.updated,
            "planningEvents": sync.planning_events,
        },
        "considered": result.considered,
        "sent": result.sent,
        "duplicates": result.duplicates,
        "skipped": result.skipped,
    }
