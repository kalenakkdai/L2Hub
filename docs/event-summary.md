# Event Summary / Wrapped

Flagship pipeline for post-event Wrapped experiences: request → approve →
generate → publish, plus agenda drafts, live debrief bubbles, and
notifications.

## Events tab lifecycle

AC approval/enablement in Event Planning promotes the plan into the shared
Events catalog through `POST /events/from-plan`. Promotion is idempotent by
plan id and creates an `active` event with an all-day scheduled window.

An approved event appears under **Happening now** immediately, even when its
date is in the future. It stays there until both conditions are true:

1. the scheduled event date/window has passed; and
2. Wrapped status is `generated`, `published`, or `archived`.

This keeps active post-event debrief work visible instead of moving the event
to Previous before Wrapped is ready. Scheduled but unapproved events remain
under Upcoming.

## Status machine

```
not_requested
  → pending_approval   (ASBO / Committee Head request)
  → generating         (AC / President approve or direct generate)
pending_approval
  → generating         (approve)
  → not_requested      (reject)
generating
  → generated          (success)
  → pending_approval   (retryable failure; MVP runs sync so rare)
generated
  → published          (publish)
  → generating         (regenerate)
published
  → archived
```

## Permissions

| Action | President | AC | ASBO | Committee Head | Member |
|--------|-----------|----|------|----------------|--------|
| Request generation | Yes | Yes | Yes | Own managed events | No |
| Approve / reject | Yes | Yes | No | No | No |
| Generate / regenerate | Yes | Yes | No | No | No |
| Publish | Yes | Yes | No | No | No |
| Mark reviewed with class | Yes | Yes | Yes | No | No |
| View draft Wrapped | Yes | Yes | No | No | No |
| View published Wrapped | Yes | Yes | Yes | Yes | Yes |
| Generate agenda | Yes | Yes | No | No | No |
| Live bubbles | Yes | Yes | Yes* | No* | No |
| Notifications (own) | Yes | Yes | Yes | Yes | Yes |

\* Live monitor requires `debrief.view_all`, `attendance.view_all`, or
`wrapped.generate` (ASBO typically has the first).

ASBO **cannot** edit grades (`grades.edit` removed for this policy) and
**cannot** approve/publish/generate Wrapped.

## Generation

MVP uses a **deterministic synthesis provider** (no paid AI). Stages are
written to `event_summaries.generation_stage` and polled via
`GET /events/{ref}/summary/status`:

1. Collecting submissions
2. Analyzing responses
3. Generating insights
4. Comparing previous years
5. Building Wrapped
6. Creating agenda
7. Done

Payload includes Wrapped slides, Feedback Constellation graph, executive
summary, and agenda draft. Anonymous contributors are redacted (no author
ids/names in API responses for anonymous quotes).

## Class review and the event recap

Each event row on `/events` has an expander arrow that drops down a condensed
Wrapped recap. It stays hidden until the class has been through the Wrapped
together.

- `POST /events/{ref}/wrapped/presented` (`wrapped.present`) stamps
  `event_summaries.presented_at` from the server clock. The first walkthrough
  wins, so repeat calls never move the timestamp.
- The Wrapped deck fires this when the presenter reaches the final slide; list
  view offers the same action as a button for reduced-motion presenters.
- `GET /events/{ref}/recap` returns the recap and 403s with
  `wrapped_not_presented` until then. It also enforces the normal Wrapped view
  rules, so members still see nothing before publish.
- The recap carries theme headlines only — never contributor quotes, names, or
  committees — so anonymous feedback cannot be traced through it.

## Frontend routes

| Route | Purpose |
|-------|---------|
| `/events` | List + status badges |
| `/events/:id/summary` | Request / approve / publish |
| `/events/:id/summary/generating` | Generation theater |
| `/events/:id/wrapped` | Cinematic stories + constellation |
| `/events/:id/agenda` | Leadership agenda |
| `/events/:id/live` | Participant bubbles |

Wrapped supports keyboard arrows, reduced-motion preference, and a list
fallback. Constellation is force-directed (green/white), drag + settle,
detail rail with anonymous labeling.

## Seed data

- `president@l2hub.local` — President (rank 100, AC-equivalent bundle)
- Maze Day 2025 (archived comparison) + Maze Day 2026 (complete)
- Synthetic debrief participants for live bubbles

## Key code paths

| Concern | Location |
|---------|----------|
| Permission keys / bundles | `backend/app/core/permission_keys.py`, `role_catalog.py` |
| State machine | `backend/app/services/event_summary/service.py` |
| Deterministic provider | `backend/app/services/event_summary/deterministic.py` |
| API | `backend/app/api/routes_events.py` |
| Models + migration | `backend/app/models/event_summary.py`, `supabase/migrations/20260807010000_event_summaries.sql` |
| Frontend | `frontend/src/features/event-summary/` |
