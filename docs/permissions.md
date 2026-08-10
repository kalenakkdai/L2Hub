# L2 Hub permissions

Discord-inspired role hierarchy with granular permission keys, scoped access,
deny-by-default resolution, and backend enforcement.

Frontend checks are convenience only. Every API route must call
`require_permission` / `has_permission`.

## Role hierarchy

| Role | Slug | Rank | Meaning |
|------|------|------|---------|
| AC | `ac` | 100 | Administrator. Unrestricted access. |
| President | `president` | 100 | Second super-admin; same permission bundle as AC. |
| ASBO | `asbo` | 80 | Broad operational access including event-planning enablement; no private/anonymous feedback; no grade assign/publish. |
| Committee Head | `committee_head` | 50 | Scoped to committees they lead. |
| Class Officer | `class_officer` | 25 | Senior/Junior Class Officers. Edit Class Officers fundraiser and homecoming plans. |
| Class Advisor | `class_advisor` | 20 | Faculty advisors (two per class). View Class Officers progress only. |
| Member | `member` | 10 | Own profile, assignments, submissions, grades. |

There are no role aliases and no profile role enum. Protected system roles
cannot be deleted. President and AC are both `is_superadmin` for assignment
and committee access.

### Class Officers platform

| Capability | President | AC | ASBO | Class Officer | Class Advisor | Committee Head | Member |
|------------|-----------|----|------|---------------|---------------|----------------|--------|
| `class_officers.view` | Yes | Yes | Yes | Yes | Yes | No | No |
| `class_officers.manage` | Yes | Yes | Yes | Yes | No | No | No |

Class Advisors intentionally do not inherit the Member baseline — their only
platform job is watching Class Officers progress (plus `notifications.view_own`
so the shell bell works).

### Note Taker

| Capability | President | AC | ASBO | Class Officer | Class Advisor | Committee Head | Member |
|------------|-----------|----|------|---------------|---------------|----------------|--------|
| `note_taker.view` | Yes | Yes | Yes | Yes (via Member) | No | Yes (via Member) | Yes |
| `note_taker.record` | Yes | Yes | Yes | Yes (via Member) | No | Yes (via Member) | Yes |
| `note_taker.manage` | Yes | Yes | Yes | No | No | No | No |

Members see their own meetings. `note_taker.manage` lets ops open any session.
See `docs/note-taker.md` for Chrome Web Speech setup (Whisper is optional fallback).

### Attendance and whereabouts

| Capability | President | AC | ASBO | Committee Head | Member |
|------------|-----------|----|------|----------------|--------|
| `attendance.view_all` | Role yes* | Role yes* | Role yes* | No | No |
| `attendance.manage_all` | No† | No† | No† | No | No |
| `attendance.view_committee` | Yes | Yes | Yes | Led committees only | No |
| `attendance.manage_committee` | Yes | Yes | Yes | Led committees only | No |

\* `attendance.view_all` remains on ASBO/AC/President role bundles for the
whereabouts map. † Effective `attendance.manage_all` is **not** granted by role
alone — only Mr. Jan and Jadon Li (see
`app/services/attendance_operators.py`) receive it at auth time. Other
AC/ASBO/President accounts are stripped of `attendance.manage_all` so they
cannot open `/attendance` or call kiosk setup APIs.

The scanner, protected student-ID/parent-contact setup, daily close, and manual
edits require `attendance.manage_all`. Committee heads only use the whereabouts
map, and its backend response is filtered to members of committees they lead.
Passkey enrollment is a separate self-only operation: an authenticated student
can register a public-key credential only for their own profile after an
operator enrolls their student ID. See `docs/attendance.md`.

### L2 Board and cross-committee requests

| Capability | President | AC | ASBO | Class Officer | Committee Head | Member |
|------------|-----------|----|------|---------------|----------------|--------|
| `tasks.view_all` — the L2 Board at `/board` | Yes | Yes | Yes | Yes | Yes | Yes |
| `requests.view_all` — the cross-org log at `/requests` | Yes | Yes | Yes | Yes | Yes | Yes |
| `requests.view_own_committee` | Yes | Yes | Yes | Yes | Yes | Yes |
| `requests.create` | Yes | Yes | Yes | Yes | Yes | Yes |
| `requests.manage_own_committee` — accept, decline, complete | Yes | Yes | Yes | Own committee | Own committee | Own committee |
| `tasks.manage_committee` — add and edit that committee's tasks | Yes | Yes | Yes | Own committee | Own committee | Own committee |
| `tasks.manage_all` | Yes | Yes | Yes | No | No | No |
| `requests.manage_all` — act for a committee you are not in | Yes | Yes | Yes | No | No | No |

The two tabs replaced the Tools and Resources placeholders. **Reading is open
to the whole class** — that is the point of both. The board only helps if
everyone can see what each committee is up to, and the request log only stops
work getting lost if the people doing the work can read it.

**Writing is not open.** A camper adds tasks to, and answers requests sent to,
the committees they are actually in. Those are the committee-scoped keys, and
they resolve against `user_roles.committee_id` / committee membership.

`view_all` and `manage_all` are deliberately separate for this reason. Everyone
sees every request; only platform ops can answer one that was sent to a
committee they are not in.

Class Advisors hold none of these. Their bundle is a deliberate minimum
(`class_officers.view` plus `notifications.view_own`) and they are not in the
operational loop the board describes.

## Scope model

Permissions resolve with optional context:

- **GLOBAL** — AC / President / ASBO operational grants
- **COMMITTEE** — Committee Head assignments (`user_roles.committee_id`)
- **EVENT** — reserved (`user_roles.event_id`)
- **SELF** — own-resource keys (`grades.view_own`, `debrief.view_own`, …)

`has_permission(user, key, committee_id=…, resource_owner_id=…)` returns true
only when the key is allowed, not denied, and the scope matches.

## Override effects

`allow` / `deny` / `inherit`

- Default is deny (missing key ⇒ denied).
- Explicit **deny** overrides allow.
- There is no hidden AC/President superuser bypass of explicit denies.

## Feedback boundary

Only AC and President receive:

- `feedback.view_private`
- `feedback.view_anonymous`
- `feedback.manage`

ASBO, Committee Head, and Member receive **403** from feedback endpoints.
Responses never include author metadata.

## Event Summary / Wrapped matrix

| Capability | President | AC | ASBO | Committee Head | Member |
|------------|-----------|----|------|----------------|--------|
| `wrapped.request` | Yes | Yes | Yes | Own managed events | No |
| `wrapped.approve` | Yes | Yes | No | No | No |
| `wrapped.generate` | Yes | Yes | No | No | No |
| `wrapped.publish` | Yes | Yes | No | No | No |
| `wrapped.edit` | Yes | Yes | No | No | No |
| `wrapped.present` | Yes | Yes | Yes | No | No |
| `wrapped.view_published` | Yes | Yes | Yes | Yes | Yes |
| `agenda.generate` | Yes | Yes | No | No | No |
| `notifications.view_own` | Yes | Yes | Yes | Yes | Yes |
| `grades.assign` | Yes (Jadon) | Yes (Jan) | **No** | No | No |
| `grades.grade_committee` | Yes (Jadon, all) | Yes (Jan, all) | **No** | Yes (committee category) | No |
| `grades.publish` | Yes (Jadon) | Yes (Jan) | **No** | No | No |
| `grades.request_assignment` | Yes (Jadon) | Yes (Jan) | **No** | Yes (own) | No |
| `grades.edit` | Legacy (unused) | Legacy (unused) | **No** | No | No |
| `planning.enable` | Yes | Yes | Yes | No | No |

Gradebook workflow: only Jan and Jadon may grade individual assignments, edit
rubrics, mass-grade, approve draft assignment requests, and publish
(`grades.assign` / `grades.publish`). Committee heads send draft assignment
requests to Jan and enter class-wide scores in the separate **Committee
grades** category (`grades.grade_committee`). Those scores stay unpublished
until Jan or Jadon releases them. Every change one operator makes notifies the
other so the book stays transparent between them.

Event planning enablement (`planning.enable`) is shared by Jan, Jadon, and every
ASBO — any of them may approve a plan so assignees can accept.

See [event-summary.md](./event-summary.md) for the full workflow.

## Capability matrix

| Capability | President | AC | ASBO | Committee Head | Member |
|------------|-----------|----|------|----------------|--------|
| View all events | Yes | Yes | Yes | Own committee events | Assigned events |
| Start debrief | Yes | Yes | Yes | No (unless later granted) | No |
| Enable event planning | Yes | Yes | Yes | No | No |
| View all grades | Yes | Yes | Yes | No | No |
| View own grades | Yes | Yes | Yes | Yes (own) | Yes |
| View committee grades | Yes | Yes | Yes | Yes (own) | No |
| Assign / edit rubrics | Yes (Jadon) | Yes (Jan) | No | No | No |
| Grade / mass-grade assignments | Yes (Jadon) | Yes (Jan) | No | No | No |
| Approve assignment drafts | Yes (Jadon) | Yes (Jan) | No | No | No |
| Request assignment drafts | Yes | Yes | No | Yes (own) | No |
| Enter committee-category grades | Yes (Jadon) | Yes (Jan) | No | Yes (own committee → class) | No |
| Publish grades | Yes (Jadon) | Yes (Jan) | No | No | No |
| View private/anonymous feedback | Yes | Yes | No | No | No |
| Manage users (Users page) | Yes | Yes | No by default | No | No |
| View other committees | Yes | Yes | Yes | No | No |
| Manage own committee tasks | Yes | Yes | Yes | Yes (own) | No |

Jan and Jadon are gradebook operators (email/name allowlist, same pattern as
attendance). Other AC/President accounts that are not on that list do **not**
receive assign, publish, or org-wide grading — only the allowlisted pair does.

## Dashboard modules

`GET /auth/dashboard` returns `{ roles, permissions, modules }` derived from
effective permissions.

Examples:

- Member → `my_tasks`, `my_events`, `my_grades`, …
- Committee Head → personal + committee modules
- ASBO → operational modules, **no** `feedback_review`
- AC / President → all modules including `feedback_review`, `user_management`, `system_settings`

## Users page

Route: `/admin/users` (API: `GET /admin/users`)

- Requires `users.view` (AC / President / ASBO).
- `users.manage` (invite / sync writes) stays AC / President.
- Lists **real** profiles + role assignments + committee memberships.
- Synthetic preview users are never stored in `profiles` and do not appear.

## Class Officers cohorts

- SCO → senior workspace only; JCO → junior workspace only.
- ASBO / AC / President see **both** via a Senior / Junior switcher (same UI, isolated data).

## Seed accounts

`seed_development_users()` creates:

| Email | Role |
|-------|------|
| `ac@l2hub.local` | AC |
| `president@l2hub.local` | President |
| `asbo@l2hub.local` | ASBO |
| `community.head@l2hub.local` | Member + Community Committee Head |
| `spirit.head@l2hub.local` | Member + Spirit Committee Head |
| `community.member@l2hub.local` | Community Member |
| `spirit.member@l2hub.local` | Spirit Member |
| `senior.advisor1@l2hub.local` / `senior.advisor2@l2hub.local` | Senior Class Advisors (view only) |
| `junior.advisor1@l2hub.local` / `junior.advisor2@l2hub.local` | Junior Class Advisors (view only) |
| `sco@l2hub.local` | Senior Class Officer |
| `jco@l2hub.local` | Junior Class Officer |

Local Supabase Auth login (email/password) is wired up for one account per role.
The password for every seeded account is `l2hubdev`:

| Role | Login email |
|------|-------------|
| Member | `community.member@l2hub.local` |
| Committee Head | `community.head@l2hub.local` |
| Class Advisor (view-only) | `senior.advisor1@l2hub.local` |
| Class Officer | `sco@l2hub.local` |
| ASBO | `asbo@l2hub.local` |
| AC | `ac@l2hub.local` |
| President | `president@l2hub.local` |

## Key code paths

| Concern | Location |
|---------|----------|
| Permission keys | `backend/app/core/permission_keys.py` |
| Role bundles | `backend/app/core/role_catalog.py` |
| Resolver | `backend/app/services/authorization.py` |
| Dashboard modules | `backend/app/services/dashboard.py` |
| Audit log | `backend/app/services/audit.py` |
| Seed | `backend/app/db/seed.py` |
| SQL migration | `supabase/migrations/20260807000000_rbac_hierarchy.sql` |
| Event Summary migration | `supabase/migrations/20260807010000_event_summaries.sql` |
