# Architecture (MVP)

## Folders

- `frontend/` — React + TypeScript + Vite UI
- `backend/` — FastAPI + SQLAlchemy API
- `docs/` — project documentation

## Frontend responsibilities

- Pages and forms for students, officers, and advisers
- Live countdown display using backend-provided `ends_at`
- WebSocket client for live participant status
- Calling backend APIs (never treating frontend-only checks as security)

## Backend responsibilities

- Authentication and authorization (JWT + role checks)
- Session timing (start/end, lateness, grading)
- Submissions, gradebook creation, Wrapped, agendas
- WebSocket updates for live dashboards
- Privacy redaction for anonymous concerns

## Local development defaults

| Service  | URL                         |
|----------|-----------------------------|
| Frontend | http://localhost:5173       |
| Backend  | http://127.0.0.1:8000       |
| Health   | http://127.0.0.1:8000/health |

## Data store

Supabase (hosted Postgres) is the database, and Supabase Auth issues user
identities. Schema changes are versioned SQL files in `supabase/migrations/`.

- `public.profiles` holds app-level identity (name, role), one row per
  `auth.users` row, created automatically by a signup trigger.
- Row Level Security is enabled on every application table.
- The FastAPI backend connects with a privileged role and therefore bypasses
  RLS; it performs its own authorization. RLS protects direct client access.

SQLite remains the fallback for tests and for running without a Supabase
project configured.

## Roles

Four roles, least- to most-privileged. The order is declared identically in
the `public.user_role` Postgres enum and in `backend/app/core/permissions.py`;
keep them in sync when adding a role.

| Role | Meaning |
|----------------|---------------------------------------------------|
| `student` | Default. Every account starts here. |
| `committee_head` | Leads one committee. |
| `officer` | Runs the organisation: sessions, grading, roster. |
| `adviser` | Staff supervisor. Full access. |

Two groupings are used for authorization:

- **Staff** — `officer`, `adviser`. Organisation-wide authority, including
  reading the full roster.
- **Leadership** — `committee_head`, `officer`, `adviser`. Leads other members.

`committee_head` is intentionally *not* staff. A committee head should see
their own committee, not every user, and there is no committees table yet to
scope that against — so the broad grant is withheld rather than given now and
revoked later. Backend gates live in `app/api/deps.py`
(`require_roles`, `require_min_role`, `require_staff`, `require_leadership`).

Role assignment is deliberately one-directional: signup always creates a
`student`, regardless of what the client sends in its signup metadata. Raising
a role is a privileged operation performed by staff.

## Authentication flow

1. The frontend signs in through Supabase Auth and receives an access token.
2. It calls the backend with `Authorization: Bearer <token>`.
3. The backend verifies the signature (JWKS for ES256/RS256, shared secret for
   legacy HS256) plus issuer, audience, and expiry.
4. The caller's role is loaded from `profiles` — never trusted from the token.

`GET /auth/me` returns the current caller's profile.

## Frontend routes

| Route | Access | Purpose |
|---------------|-----------------|--------------------------------------|
| `/` | Any | Redirects: signed in → `/dashboard`, otherwise → `/login` |
| `/login` | Signed out | Email/password sign-in. Signed-in visitors are sent to `/dashboard`. |
| `/dashboard` | Signed in | Shows the caller's name and role from `/auth/me`, plus logout. |
| `/dev/health` | Any | Backend health check. Unauthenticated on purpose — diagnostics must work when sign-in does not. |

### Session handling

`AuthProvider` is the single owner of session state. The Supabase client
persists the session and refreshes the access token on its own, so:

- **The app never stores a second copy of the token.** `apiFetch` reads it
  from the live session on every request, which means it cannot go stale.
- **Refresh restores the session** through `getSession()` on mount. A
  `loading` state prevents the login page flashing before it resolves.
- **Expired sessions** are caught from either direction: the Supabase client
  emits `SIGNED_OUT` when a refresh token can no longer be renewed, and a 401
  from the backend raises `SessionExpiredError`. Both paths sign out, clear
  the TanStack Query cache, and land on `/login` with an explanation.
- **Logout** does the same, minus the explanation.

Clearing the query cache on sign-out matters: cached responses belong to the
user who just left and must not survive into the next session.
