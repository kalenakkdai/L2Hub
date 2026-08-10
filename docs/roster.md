# Leadership 2 roster

Canonical spreadsheet sync (Aug 2026).

## Source of truth in code

| Layer | Path |
|-------|------|
| Frontend fixtures | `frontend/src/data/l2Roster.ts` |
| Backend seed data | `backend/app/db/l2_roster.py` |

## Column aliases

| Spreadsheet | App slug / meaning |
|-------------|--------------------|
| ASBOS | `asbo` **role** (not a committee) |
| A-Team | `activities` (Activities) |
| Fund | `fundraising` |
| Vid | `videography_photography` |

## What Chunk 1 does / does not do

**Done:** fixture + planning mock roster updated to the sheet; shared modules added.

**Not done yet (needs emails or invite flow):** creating ~50 Supabase `auth.users` and `committee_memberships` rows in production. Students still sign up on https://msjquad.org; AC can then assign committees/roles in Users admin once that UI can edit memberships.

## ASBOs

- Jadon Li
- Ariel Duong
- Kaiwei Parks
- Melody Gao
- Hanna Rahmanian
