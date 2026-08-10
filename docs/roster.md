# Leadership 2 roster

Canonical spreadsheet sync (Aug 2026).

## Source of truth in code

| Layer | Path |
|-------|------|
| Frontend fixtures | `frontend/src/data/l2Roster.ts` |
| Backend people + committees | `backend/app/db/l2_roster.py` |
| Initial Auth passwords (gitignored) | `backend/data/roster_credentials.json` |
| Attendance student IDs (gitignored) | `backend/data/roster_student_ids.json` |

**Passwords and student IDs are different variables.** Syncing or changing a
login password never overwrites the attendance digest, and enrolling a student
ID never resets Auth.

## Column aliases

| Spreadsheet | App slug / meaning |
|-------------|--------------------|
| ASBOS | `asbo` **role** (not a committee) |
| A-Team | `activities` (Activities) |
| Fund | `fundraising` |
| Campus | `gtac` (display name Campus) |
| Vid | `videography_photography` |
| Baby | `membership_type=baby` (member role + Shadow UI) |
| Head | `is_head` + scoped `committee_head` role |

## Provisioning accounts

Login = spreadsheet email. Initial password = `roster_credentials.json`.

```bash
cd backend
# One-time: split any old combined credentials file
.venv/bin/python scripts/split_roster_secrets.py
export SUPABASE_URL=https://ipdasusozjcxvvnsfkkq.supabase.co
export SUPABASE_SERVICE_KEY=...   # service_role secret — never commit
.venv/bin/python scripts/provision_roster_users.py
```

Existing users are **not** password-reset unless you pass `--reset-passwords`.

Then AC → Campers → **Sync roster** so committees / baby / head / asbo attach
**and** student IDs from `roster_student_ids.json` enroll into attendance
(matched by email, then by name).

## SCO / JCO (Class Officers)

| Spreadsheet note | Cohort | Workspace |
|------------------|--------|-----------|
| `SCO …` | senior | Senior Class Officers |
| `JCO …` | junior | Junior Class Officers |

Same UI routes (`/class-officers/*`). Data is isolated per cohort — junior never reads or writes senior plans and vice versa. ASBO/AC can switch cohorts in the header; SCO/JCO stay locked.

Roster sync assigns the `class_officer` role when notes contain SCO or JCO.

## Shadow (baby campers)

Babies keep the member role. On the dashboard they get **Shadow** and **Request duration**.
That creates a `shadow_requests` row; committee heads get a notification and can Accept/Deny.
Approved grants elevate head-level committee permissions until `ends_at`.
