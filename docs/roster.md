# Leadership 2 roster

Canonical spreadsheet sync (Aug 2026).

## Source of truth in code

| Layer | Path |
|-------|------|
| Frontend fixtures | `frontend/src/data/l2Roster.ts` |
| Backend people + committees | `backend/app/db/l2_roster.py` |
| Student ID passwords (gitignored) | `backend/data/roster_credentials.json` |

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

Login = spreadsheet email. Password = student ID#.

```bash
cd backend
export SUPABASE_URL=https://ipdasusozjcxvvnsfkkq.supabase.co
export SUPABASE_SERVICE_KEY=...   # service_role secret — never commit
.venv/bin/python scripts/provision_roster_users.py
```

Then AC → Campers → **Sync roster** so committees / baby / head / asbo attach.

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
