# Local Setup

## Prerequisites

- Python 3.12
- Node.js 20+ and npm
- Git

## Backend

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Health check:

```bash
curl http://127.0.0.1:8000/health
```

Expected response:

```json
{"status":"ok"}
```

Run the tests:

```bash
cd backend
./.venv/bin/python -m pytest
```

The tests are self-contained: they use an in-memory SQLite database and
locally generated signing keys, so they never touch the real Supabase project
or the values in `.env`.

## Supabase

Fill in `SUPABASE_URL` and `SUPABASE_DB_URL` in `backend/.env` from the
Supabase dashboard (Project Settings → API and → Database). Leave
`SUPABASE_JWT_SECRET` blank unless the project still uses the legacy HS256
signing secret.

### Applying migrations

Migrations live in `supabase/migrations/` as plain SQL, newest last. To apply
one, open the Supabase dashboard → SQL Editor, paste the file's contents, and
run it. Apply files in filename order and only once each.

`20260805000000_create_profiles.sql` creates:

- `public.user_role` — enum of `student`, `committee_head`, `officer`,
  `adviser`, declared least- to most-privileged
- `public.profiles` — one row per `auth.users` row
- `on_auth_user_created` — trigger that creates a profile on signup
- `public.is_staff()` — helper used by the roster read policy
- Row Level Security policies, plus a trigger blocking role self-promotion

To verify it worked, sign up a test user and confirm a matching row appears in
`public.profiles` with role `student`.

### Granting a role

Signup always produces a `student`; the trigger ignores any role the client
puts in its signup metadata. To promote someone, run this in the SQL Editor
(which connects as a privileged role, so it passes the self-promotion guard):

```sql
update public.profiles
set role = 'officer'          -- or committee_head / adviser
where email = 'person@example.edu';
```

### How auth works

The frontend obtains a Supabase access token and sends it as
`Authorization: Bearer <token>`. The backend verifies the signature itself —
against the project's JWKS endpoint for ES256/RS256 tokens, or the shared
secret for legacy HS256 — and checks the issuer, audience, and expiry. Roles
are read from the `profiles` table, never from claims in the token.

Note that the backend connects to Postgres with a privileged role, which
bypasses RLS. RLS is the safety net for direct client access; the backend's
own authorization checks are what protect its endpoints.

## Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Open http://localhost:5173 — the home page should show that the backend health check succeeded.

## Notes

- Never commit `.env` files.
- Never commit `.venv/`, `node_modules/`, or SQLite database files.
- `.env.example` files are safe templates and should be committed.
