# Architecture (MVP)

## Folders

- `frontend/` — React + TypeScript + Vite UI
- `backend/` — FastAPI + SQLAlchemy API
- `docs/` — project documentation

## Frontend responsibilities

- Pages and forms for Members, Committee Heads, ASBO, President, and AC
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

- `public.profiles` holds app-level identity, one row per `auth.users` row,
  created automatically by a signup trigger.
- Roles are normalized through `roles` and `user_roles`; profiles do not have
  a role enum or role column. Every signup receives Member.
- Row Level Security is enabled on every application table.
- The FastAPI backend connects with a privileged role and therefore bypasses
  RLS; it performs its own authorization. RLS protects direct client access.

SQLite remains the fallback for tests and for running without a Supabase
project configured.

## Object storage

File blobs (screenshots, future knowledge uploads) go through an injectable
`ObjectStorage` protocol in `backend/app/storage/`. Call sites depend on the
protocol via FastAPI `Depends(get_storage)`, not a concrete folder or bucket.

| `STORAGE_BACKEND` | Implementation |
|-------------------|----------------|
| `local` (default) | Files under `STORAGE_LOCAL_ROOT` or `backend/.local-storage` |
| `s3` / `gcs` | Reserved — swap in a cloud backend later without changing callers |

Keys are opaque UUIDs (never original filenames) so anonymous attachments
cannot leak author identity through storage paths.

## Roles

Five protected system roles (Discord-inspired hierarchy). See
[`docs/permissions.md`](permissions.md) for permission keys, scopes, and the
capability matrix.

| Role | Slug | Rank |
|------|------|------|
| AC | `ac` | 100 |
| President | `president` | 100 |
| ASBO | `asbo` | 80 |
| Committee Head | `committee_head` | 50 |
| Member | `member` | 10 |

AC and President are peer super-admins. Effective access is resolved from role
assignments + overrides. Backend enforcement lives in
`app/services/authorization.py`.

`committee_head` is intentionally *not* staff. A committee head sees their own
committee, not every user. Feedback remains AC-only.

## Authentication flow

1. The frontend signs in through Supabase Auth and receives an access token.
2. It calls the backend with `Authorization: Bearer <token>`.
3. The backend verifies the signature (JWKS for ES256/RS256, shared secret for
   legacy HS256) plus issuer, audience, and expiry.
4. The caller's active roles are loaded from `user_roles` — never trusted from
   the token.

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
