# L2 Hub

Student-government operations platform for Mission San Jose High School’s Leadership 2 class.

The first launch product is a synchronized five-minute Maze Day event debrief.

## Repository layout

```
L2Hub/
  backend/     Python FastAPI API
  frontend/    React + TypeScript + Vite UI
  docs/        Project documentation
  .gitignore
  README.md
```

## Quick start

### 1. Backend

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Verify:

```bash
curl http://127.0.0.1:8000/health
```

### 2. Frontend

In a second terminal:

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Open http://localhost:5173. The home page should report a successful backend health check.

## Supabase: local or shared

There are two databases, and which one you are on is decided by whether
`.env.local` exists — not by a flag you have to remember.

| | Shared cloud project | Local stack |
|---|---|---|
| Config | `backend/.env`, `frontend/.env` | plus `backend/.env.local`, `frontend/.env.local` |
| Used by | everyone, including Kalena | only your machine |
| Phone verification | unavailable (no SMS provider) | works, via `[auth.sms.test_otp]` |
| Safe to break | no | yes — recreate it in a minute |

**Migrations get tested locally before they touch shared.** The cloud project
is one database serving both developers: a migration pushed there lands in
someone else's work-in-progress, and a bad one is not something you can take
back. `supabase db reset` locally costs a minute; a broken shared project
costs whatever the other person was doing.

### Switching to local

Requires Docker (Docker Desktop or OrbStack) — `supabase start` runs the stack
in containers.

```bash
supabase start                       # first run pulls images; a few minutes
supabase db reset                    # applies every migration in order
cp backend/.env.local.example  backend/.env.local
cp frontend/.env.local.example frontend/.env.local
supabase status -o env               # copy the keys into the two files
```

`supabase db reset` replays `supabase/migrations/` from scratch, which includes
`20260807040000_seed_development_users.sql` — so the local database comes up
with the same accounts as the shared one, all with the password `l2hubdev`:

| Email | Role |
|---|---|
| `ac@l2hub.local` | AC |
| `president@l2hub.local` | President |
| `asbo@l2hub.local` | ASBO |
| `community.head@l2hub.local` | Committee head |
| `community.member@l2hub.local` | Member |

Restart both servers afterwards; neither re-reads its env file while running.

### Switching back to shared

```bash
mv backend/.env.local  backend/.env.local.off
mv frontend/.env.local frontend/.env.local.off
```

Move both, or the browser and the API end up on different databases and the
symptom looks like missing rows rather than a misconfiguration.

### Applying a migration

```bash
supabase db reset          # local: replay everything, confirm it is clean
supabase db push --linked  # shared: only once the above worked
```

`supabase db push` sends migrations only. **Never run `supabase config push`** —
everything under `[auth]` in `supabase/config.toml` is written for local
development, including a fixed `test_otp` map that accepts a hardcoded SMS
code without sending anything.

### Verifying against a real database

`scripts/verify_live.py` signs in as a seeded account and exercises RLS,
GRANTs, and storage rules over HTTP — the things mocked tests cannot see.

```bash
python3 scripts/verify_live.py all
```

It reads `frontend/.env`, then `frontend/.env.local` if present, so it follows
the same switch as everything else. Prefer running it against local: it writes
and deletes rows, and on the shared project that is someone else's data.

## Documentation

- [Overview](docs/overview.md)
- [Setup](docs/setup.md)
- [Architecture](docs/architecture.md)

## Tech stack

**Frontend:** React, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query, React Hook Form, Zod, Recharts, Lucide React, Vitest

**Backend:** Python 3.12, FastAPI, SQLAlchemy 2, Pydantic v2, Alembic, SQLite (local), JWT, WebSockets, Pytest, Ruff
