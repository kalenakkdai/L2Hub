# Deploying L2 Hub

Frontend on AWS Amplify Hosting. Backend as a container — on Render, or on
Amazon ECS Express Mode if it has to be AWS. Supabase stays where it is; these
hosts run the two halves of this repo, not the database.

## Before you start

Three things are true of this repo right now and change the standard steps:

- **It is a monorepo.** Amplify and any backend build need pointing at
  `frontend/` and `backend/` explicitly, not at the repo root.
- **The shared Supabase project is behind this branch.** Querying it directly,
  the only bucket is `avatars` and there are no `attendance_*` or note-taker
  tables — so `20260808030000_note_taker.sql`, `20260808040000_attendance_tracker.sql`,
  and everything after are unapplied. Deploy without pushing them and Note Taker
  and Attendance fail at runtime against a database that has no tables for them.
  Pushing migrations also hits Kalena's environment, since it is one project.
- **The backend needs one secret the frontend must never see.** With
  `STORAGE_BACKEND=supabase` it uses the Supabase **secret** key, which bypasses
  RLS. That is appropriate server-side — authorization is enforced by
  `require_permission` on the routes — but it means the key belongs in a secret
  store, never in a `VITE_` variable.

## Frontend — Amplify Hosting

1. Amplify console → **Create new app** → **Deploy from GitHub** → authorize →
   pick `kalenakkdai/L2Hub`, branch `main`.
2. Amplify picks up [amplify.yml](../amplify.yml) at the repo root. Leave the
   build settings alone — it already declares `appRoot: frontend`, `npm ci` +
   `npm run build`, and `dist` as the artifact directory.
3. Under **App settings → Environment variables**:

   | Variable | Value |
   |---|---|
   | `AMPLIFY_MONOREPO_APP_ROOT` | `frontend` |
   | `VITE_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_...` |
   | `VITE_API_BASE_URL` | the backend URL, no trailing slash |
   | `VITE_SMS_ENABLED` | `false` until an SMS provider is configured |

   `AMPLIFY_MONOREPO_APP_ROOT` is required, not optional — without it Amplify
   does not know which folder in the monorepo the app belongs to.

   The key variable is `VITE_SUPABASE_PUBLISHABLE_KEY`, not
   `VITE_SUPABASE_ANON_KEY` — see [frontend/src/lib/supabase.ts](../frontend/src/lib/supabase.ts).
   Anon key is the older name for the same value. Never put an `sb_secret_...`
   or service role key in a `VITE_` variable: everything `VITE_`-prefixed is
   compiled into the bundle and readable by every visitor.

4. Under **App settings → Rewrites and redirects**, add a SPA rewrite so deep
   links work. The app uses `react-router-dom`, so a hard refresh on `/events`
   asks the CDN for a file that does not exist and 404s without it:

   | Source | Target | Type |
   |---|---|---|
   | `</^[^.]+$\|\.(?!(css\|gif\|ico\|jpg\|js\|png\|txt\|svg\|woff\|woff2\|ttf\|map\|json\|webp)$)([^.]+$)/>` | `/index.html` | `200 (Rewrite)` |

   Amplify sometimes adds this itself when it detects a SPA. Check before adding
   a duplicate.

5. Deploy. You get `https://main.<app-id>.amplifyapp.com` with HTTPS included.

`VITE_API_BASE_URL` is baked in at build time, so once the backend exists you
have to **redeploy** the frontend, not just edit the variable.

## Backend — why not App Runner

App Runner closed to new customers on April 30, 2026. A newer AWS account cannot
create one, so it is off the table here and `backend/apprunner.yaml` has been
deleted. AWS points new deployments at Amazon ECS Express Mode.

That matters because App Runner was the one AWS service offering "connect the
repo, click deploy." Express Mode wants an image already sitting in ECR, so the
AWS path is now: build locally → create an ECR repo → authenticate → push →
deploy. Express Mode also only launched in November 2025, so there is not much
written about it yet when something goes wrong.

Render takes [backend/Dockerfile](../backend/Dockerfile) unchanged and builds it
from GitHub with none of that. Unless hosting the backend on AWS specifically is
a requirement, take Render — the frontend is still on AWS either way.

## Backend — Render (recommended)

[render.yaml](../render.yaml) is a blueprint covering the whole service. Render
→ **New** → **Blueprint** → point at the repo, and it prompts for the secrets
(marked `sync: false`, so they never enter the repo).

If you would rather click through it: **New → Web Service**, connect the repo,
runtime **Docker**, Dockerfile path `./backend/Dockerfile`, Docker context
`./backend`, health check path `/health`. Then set the variables below by hand.

Whisper loads a model into memory, so the smallest instance sizes will OOM.
Start at Standard.

## Backend — ECS Express Mode (if it must be AWS)

1. Create an ECR repository, build, and push. Build for `linux/amd64`
   explicitly on an Apple Silicon Mac — Fargate will not run an arm64 image on
   an x86 task:

   ```
   aws ecr create-repository --repository-name l2hub-backend
   aws ecr get-login-password | docker login --username AWS --password-stdin <acct>.dkr.ecr.<region>.amazonaws.com
   docker build --platform linux/amd64 -t l2hub-backend ./backend
   docker tag l2hub-backend <acct>.dkr.ecr.<region>.amazonaws.com/l2hub-backend:latest
   docker push <acct>.dkr.ecr.<region>.amazonaws.com/l2hub-backend:latest
   ```

2. ECS console → **Express Mode** → **Create**. Give it the image URI, container
   port `8000`, and let it create the task execution and infrastructure roles.
3. Health check path `/health`, and at least 2 GB of memory for Whisper.
4. Express Mode provisions the cluster, Fargate service, ALB with an AWS-issued
   certificate, auto scaling, and a log group, then returns an HTTPS URL. That
   is your `VITE_API_BASE_URL`.

Every subsequent deploy is another manual build and push; there is no git
trigger. Wire it to GitHub Actions when that gets old.

## Backend environment variables

Same set on either host:

| Variable | Value |
|---|---|
| `ENVIRONMENT` | `production` |
| `SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `SUPABASE_DB_URL` | session pooler URI from Supabase → Project Settings → Database |
| `SUPABASE_JWT_AUDIENCE` | `authenticated` |
| `CORS_ORIGINS` | the Amplify URL, exactly as the browser sends it |
| `STORAGE_BACKEND` | `supabase` |
| `SUPABASE_SERVICE_KEY` | secret key from Project Settings → API keys |
| `SUPABASE_STORAGE_BUCKET` | `attachments` |
| `ATTENDANCE_ID_PEPPER` | the generated value — see below |
| `WEBAUTHN_RP_ID` | the Amplify hostname, no scheme — `main.<app-id>.amplifyapp.com` |
| `WEBAUTHN_ORIGIN` | the Amplify URL with scheme — `https://main.<app-id>.amplifyapp.com` |
| `ATTENDANCE_TIMEZONE` | `America/Los_Angeles` |

`SUPABASE_DB_URL`, `SUPABASE_SERVICE_KEY`, and `ATTENDANCE_ID_PEPPER` are the
three that matter. On AWS put them in Secrets Manager or SSM Parameter Store and
reference them from the task; on Render they are dashboard-only by virtue of
`sync: false`.

`CORS_ORIGINS` is matched as an exact string, character for character —
`https://main.<app-id>.amplifyapp.com`, no trailing slash, `https` not `http`. A
near miss fails the preflight with `400 Disallowed CORS origin`.

The WebAuthn pair must match the domain the browser is actually on or passkey
registration fails client-side, before the request reaches the backend. Both
change again on a custom domain, and passkeys registered against the
`amplifyapp.com` hostname do not carry over.

Leave `SUPABASE_JWT_SECRET` unset unless the project still signs tokens with the
legacy HS256 secret; verification goes through JWKS otherwise. The `SMTP_*`
variables are optional — without them the under-80% parent alerts stay queued in
the outbox rather than being falsely marked sent.

## The attendance pepper

`ATTENDANCE_ID_PEPPER` is the HMAC key that makes hashed student IDs
irreversible. It shipped defaulting to the literal string
`local-development-only-change-me`, which would make the hashes trivially
reversible by anyone who got the table.

A real value has been generated and written to `backend/.env` (gitignored) —
copy it from there into the host's secret store. Do not paste it into a file
that gets committed.

Two things about it:

- `student_id_digest` already refuses to hash when `ENVIRONMENT != development`
  and the pepper is still the default, so production fails loudly rather than
  writing weak hashes. That guard only holds if `ENVIRONMENT` is actually set to
  `production` on the host.
- Local development and production share one Supabase project, so the same
  pepper has to be set everywhere. A different value in one place writes hashes
  the other cannot match. Rotating it later orphans every existing row — which
  costs nothing today, because `attendance_identities` does not exist in the
  project yet, and is the cheapest it will ever be.

## Object storage

`STORAGE_BACKEND=local` writes to the container's own filesystem, which is wiped
on every deploy and not shared between tasks. That was survivable for
screenshots. It is not now that Note Taker stores meeting recordings there —
recordings of students, on a disk nobody is tracking, gone at the next deploy.

[backend/app/storage/supabase.py](../backend/app/storage/supabase.py) is the
durable backend. Set `STORAGE_BACKEND=supabase` and apply
[supabase/migrations/20260821000000_attachments_bucket.sql](../supabase/migrations/20260821000000_attachments_bucket.sql),
which creates a **private** `attachments` bucket with a 50 MB per-object limit.

Private is the point. The bucket has no RLS policies at all, which under
deny-by-default means neither `anon` nor `authenticated` can touch it. The only
reader is the backend, holding the secret key, handing out signed URLs that
expire. Contrast `avatars`, which is public on purpose — a face next to a name
on a roster is not a recording of a meeting.

The factory refuses to start when `STORAGE_BACKEND=supabase` and the URL, key,
or bucket is missing. That is deliberate: better a service that will not boot
than one that accepts a recording and drops it.

## Still outstanding

**`backend/requirements.txt` pins nothing.** Every image build resolves the
latest FastAPI, SQLAlchemy, torch, and everything else, so two builds of the
same commit can behave differently. With torch in the tree that is a
several-hundred-megabyte variable. Pin it before this carries real traffic.

**Whisper makes this an expensive container.** `openai-whisper` pulls in torch;
the Dockerfile installs the CPU-only wheel and bakes in the `base` model, which
keeps the image far below the ~2.5 GB the default CUDA wheel would cost, but it
is still a large image needing 2–4 GB of memory. Transcription runs in a
`BackgroundTasks` job so no load balancer times out, but it is CPU-bound work on
the same process serving traffic. If Note Taker sees real use, moving
transcription off the web service is the next structural change.

**The Supabase Storage backend has not been exercised against the live
project.** Its tests drive a real `httpx` client through a mock transport, so
the request paths, upsert header, and signed-URL assembly are verified against
the documented API — but the bucket does not exist yet and no secret key is
configured locally, so nothing has round-tripped for real. Apply the migration,
set the key, and hit `POST /storage/smoke` in a development environment before
trusting it with a recording.
