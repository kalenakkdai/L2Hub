# Activities Calendar

Source of truth for the year: the MSJ **Activities Calendar 2026–2027**
spreadsheet (exported PDF in ops handoff).

## What syncs

`POST /internal/jobs/sync-activities-calendar` (and the planning-reminders job)
upserts:

| Kind | Examples | `events.status` | Visible on `/events` | iCal feed |
|------|----------|-----------------|----------------------|-----------|
| ASB / Leadership | Maze Day, rallies, Homecoming, Kickoff, MC Week | `scheduled` (or leave `active`/`complete`) | Yes | Yes |
| Council / athletics / testing | Council (C120), sports, SAT | `calendar` | No | Yes |

ASB multi-day blocks (Kickoff Week, MC Week, Maze Day) are stored as one event
with a start and end date.

## Jan's planning reminder

`POST /internal/jobs/planning-reminders`:

1. Syncs the Activities Calendar.
2. For each ASB event, once today is on or after **three calendar months before**
   the event date (and before the event), notifies **Mr. Jan** in-app (and push
   if enabled): “Start planning: {event}”.
3. Deduped per event (`event.planning_start:{id}`) so repeats are free.

Recipient resolution: `ac@l2hub.local` / full name “Mr. Jan”; if neither is
present, every AC profile is used as a fallback.

Schedule both jobs daily (same secret as deadline reminders). Prefer running
`planning-reminders` alone if you only want one cron — it syncs first.

## Code

- Data: `backend/app/db/activities_calendar_2026_2027.py`
- Sync: `backend/app/services/activities_calendar_sync.py`
- Reminders: `backend/app/services/planning_reminders.py`
