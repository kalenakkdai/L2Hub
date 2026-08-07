# Local Setup

## Prerequisites

- Python 3.12
- Node.js 20+ and npm
- Git
- Supabase CLI (for linking and applying hosted migrations)

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

Migrations live in `supabase/migrations/` as versioned SQL. Link the project,
review the pending diff, then apply in filename order:

```bash
supabase link --project-ref <project-ref>
supabase db push --dry-run
supabase db push
```

Do not edit production tables manually in the dashboard. A schema or policy
change must be a new migration.

The complete sequence creates profiles/RBAC/event tables, then
`20260807020000_normalize_auth_and_rls.sql` removes the old role enum, seeds
the five-role hierarchy, assigns Member by default, and installs final RLS.
See `docs/authentication.md` for every migration, policy, helper, and trigger.

To verify it worked, sign up a test user and confirm:

- a matching row appears in `public.profiles`;
- there is no role column on that row;
- `public.user_roles` assigns the protected `member` role.

### Granting a role

Signup always assigns Member. Elevated access is a row in `user_roles`, never
profile metadata or a JWT claim. Assign roles only through a caller holding
`roles.assign` (or a trusted backend maintenance command). Committee Head
assignments must include `committee_id`.

### How auth works

The frontend obtains a Supabase access token and sends it as
`Authorization: Bearer <token>`. The backend verifies the signature itself —
against the project's JWKS endpoint for ES256/RS256 tokens, or the shared
secret for legacy HS256 — and checks the issuer, audience, and expiry. Roles
are read from `user_roles`, never from claims in the token.

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
