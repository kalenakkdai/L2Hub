# Authentication, roles, migrations, and Row Level Security

This document describes the normalized Supabase Auth design implemented by the
SQL migrations in `supabase/migrations/`. It is the security reference for
profile creation, role assignment, direct Supabase access, and the FastAPI
authorization boundary.

## Architecture

1. Supabase Auth owns credentials and sessions in `auth.users`.
2. The browser signs in with email/password through
   `supabase.auth.signInWithPassword`.
3. Supabase returns an access token. The frontend sends that token to FastAPI
   as `Authorization: Bearer <token>`.
4. FastAPI verifies signature, issuer, audience, and expiry, then resolves the
   token `sub` to `public.profiles.id`.
5. Roles come only from `public.user_roles`; role claims in JWT metadata are
   ignored.
6. Permissions come from `roles → role_permissions → permissions`, with
   optional committee or event scope on `user_roles`.
7. FastAPI normally connects through a privileged Postgres role and enforces
   the same permissions in Python. RLS is an independent safety boundary for
   browser/direct Supabase access.

No role is stored in `profiles`, and there is no role enum.

## Role hierarchy

| Role | Slug | Rank | Scope |
|------|------|------|-------|
| AC | `ac` | 100 | Global, protected super-admin |
| President | `president` | 100 | Global, protected super-admin |
| ASBO | `asbo` | 80 | Global operations |
| Committee Head | `committee_head` | 50 | Committee-scoped |
| Member | `member` | 10 | Global baseline |

AC and President are peers by policy. A higher rank is more privileged. Every
account receives Member at signup; elevated assignments are additive.

## Migration explanations

### `20260805000000_create_profiles.sql`

The original identity migration:

- created the legacy `public.user_role` enum;
- created `public.profiles`, keyed to `auth.users`;
- created the first signup trigger;
- enabled RLS on profiles only;
- added own/staff profile policies;
- added a trigger blocking role self-promotion.

The normalized migration preserves the profile data but removes its enum,
role column, old role helpers, old policies, and old role-change trigger.

### `20260807000000_rbac_hierarchy.sql`

The first normalized RBAC structure:

- created `roles`, `permissions`, `role_permissions`, and `user_roles`;
- created committees and committee memberships;
- created permission overrides and audit logs;
- added account status fields to profiles;
- temporarily supported both legacy and normalized role names.

The final migration keeps these tables, seeds their canonical contents,
removes legacy role rows, adds assignment uniqueness, and makes
`user_roles.event_id` a real foreign key.

### `20260807010000_event_summaries.sql`

Created event-domain tables:

- `events`;
- `event_summaries`;
- `event_summary_requests`;
- `event_agendas`;
- `notifications`;
- `debrief_participants`.

The final auth migration enables RLS on these tables and installs policies
appropriate to the normalized role system.

### `20260807020000_normalize_auth_and_rls.sql`

The authoritative auth redesign:

1. Upserts exactly five protected system roles and their hierarchy.
2. Upserts the canonical permission catalog.
3. Rebuilds deterministic role-permission bundles.
4. Gives every existing profile a Member assignment.
5. Preserves existing AC/ASBO assignments and derives Committee Head scope
   from actual headed committee memberships.
6. Remaps and deletes obsolete role-table assignments.
7. Adds a null-safe unique index preventing duplicate assignments.
8. Adds the deferred `user_roles.event_id → events.id` foreign key.
9. Removes the old profile role trigger/functions, `profiles.role`, and the
   obsolete enum.
10. Installs the new signup trigger, then backfills any missing auth users.
11. Adds SECURITY DEFINER boolean helpers for RLS.
12. Adds integrity triggers for managed profile fields, assignments, and
    protected roles.
13. Enables RLS on every application table.
14. Installs all final policies and explicit grants.

The migration is additive and data-preserving until the old role column is no
longer needed. It must be applied after the first three migrations.

## Signup trigger

### `on_auth_user_created`

Runs `public.handle_new_user()` after each insert into `auth.users`.

`handle_new_user()`:

1. looks up the protected `member` role;
2. fails loudly if the role catalog is corrupt;
3. inserts a profile using the auth user id/email and optional `full_name`
   metadata;
4. assigns Member in `user_roles`;
5. ignores all role metadata supplied by the browser.

It is `SECURITY DEFINER` with an empty `search_path`, so it can write the
profile safely while an unprivileged signup is in progress and cannot be
hijacked by shadowed objects.

## Integrity triggers

### `profiles_protect_managed_fields`

Runs `protect_profile_managed_fields()` before profile updates.

- Profile ids and emails remain owned by Supabase Auth.
- Members may update their own `full_name`.
- Changing `status` requires `users.manage`.
- Privileged database/service roles used by trusted backend maintenance are
  exempt.

### `user_roles_protect_assignment`

Runs `protect_role_assignment()` before insert, update, or delete.

- Direct authenticated writes require `roles.assign`.
- Non-superadmins cannot assign a role at or above their own rank.
- AC and President may assign protected peer roles.
- Backend/service database roles are exempt because FastAPI performs its own
  authorization.

### `roles_protect_system`

Runs `protect_system_role()` before update or delete.

- Protected roles cannot be deleted.
- Their slug, rank, and protected status cannot be changed.
- Descriptive fields may still be maintained by trusted migrations.

### `profiles_set_updated_at`

Created by the initial profile migration and retained. It updates
`profiles.updated_at` on every profile update.

## RLS helper functions

All helpers are `STABLE SECURITY DEFINER`, use a pinned empty `search_path`,
and return only a scalar boolean/integer. They do not expose other users'
assignments.

| Function | Purpose |
|----------|---------|
| `current_user_has_role(text[])` | Checks active global role assignments. |
| `current_user_rank()` | Returns the highest active assignment rank. |
| `current_user_has_permission(text, uuid, uuid)` | Resolves active allow/deny role permissions and optional committee/event scope; deny wins. |
| `current_user_is_committee_member(uuid)` | Checks the caller's membership. |
| `current_user_heads_committee(uuid)` | Checks caller headship. |
| `current_user_can_access_event(uuid)` | Allows global operations, managing-committee members, or explicit event assignees. |

## Final RLS policies

RLS is enabled on every application table. `anon` has no table privileges.
The `authenticated` role receives only the grants listed by the migration;
RLS then narrows each operation.

### Profiles

- `profiles_select_authorized`: own profile, users with `users.view`, or a
  Committee Head viewing someone in a committee they head.
- `profiles_update_authorized`: own profile or `users.manage`. Column grants
  and the integrity trigger still restrict which fields may change.
- No authenticated insert/delete: the auth trigger creates rows and
  `auth.users` cascade deletes them.

### Role catalog

- `roles_select_authenticated`: any signed-in user may read role names/ranks.
- `permissions_select_authenticated`: any signed-in user may read permission
  metadata.
- `role_permissions_select_authenticated`: any signed-in user may inspect
  bundles.
- There are no authenticated write policies or grants for these
  migration-owned catalogs.

### User role assignments

- `user_roles_select_authorized`: own assignments or callers with
  `roles.view`/`users.view`.
- `user_roles_insert_authorized`: requires `roles.assign`.
- `user_roles_update_authorized`: requires `roles.assign`.
- `user_roles_delete_authorized`: requires `roles.assign`.
- The assignment trigger independently enforces hierarchy.

### Committees

- `committees_select_authorized`: AC/President/ASBO or a member of that
  committee.
- `committees_insert_authorized`: requires `committees.manage`.
- `committees_update_authorized`: requires `committees.manage`.
- `committees_delete_authorized`: requires `committees.manage`.

### Committee memberships

- `committee_memberships_select_authorized`: own membership, `users.view`, or
  head of that committee.
- `committee_memberships_insert_authorized`: global committee management or
  a head with `committees.manage_members` for that committee.
- `committee_memberships_update_authorized`: global manager or committee head.
- `committee_memberships_delete_authorized`: global manager or committee head.

### Events

- `events_select_authorized`: requires `events.view` plus event access through
  global operations, managing-committee membership, or explicit event role.
- `events_insert_authorized`: requires `events.create`.
- `events_update_authorized`: requires `events.edit`.
- `events_delete_authorized`: requires `events.delete`.

### Authorization internals

- `permission_overrides_select_authorized`: own overrides or `roles.view`.
- `audit_logs_select_authorized`: requires `admin.audit`.
- No direct authenticated writes are granted; these remain backend-managed.

### Event Summary tables

- `event_summaries_select_authorized`: published summaries require
  `wrapped.view_published` and event access; drafts require
  `wrapped.view_all` or `wrapped.generate`.
- `event_summary_requests_select_authorized`: own requests or
  `wrapped.approve`.
- `event_summary_requests_insert_authorized`: caller must be requester, hold
  `wrapped.request`, and have event access.
- `event_agendas_select_authorized`: all-agenda/generation permission or a
  committee-scoped agenda view grant.
- Direct summary/agenda writes remain backend-only.

### Notifications

- `notifications_select_own`: only the recipient with
  `notifications.view_own`.
- `notifications_update_own`: same recipient; column grants limit the change
  to `read_at`.

### Debrief participants

- `debrief_participants_select_authorized`: own row, global debrief/attendance
  viewers, or committee-scoped debrief viewers.
- Direct writes remain backend-only so status and submission time remain
  server-authoritative.

## TypeScript types

`frontend/src/types/database.types.ts` reflects the normalized auth/RBAC
tables and RLS helper functions. `frontend/src/lib/supabase.ts` passes this
`Database` type to `createClient`.

After linking a hosted project, regenerate and review types with:

```bash
supabase gen types typescript --linked \
  > frontend/src/types/database.types.ts
```

The checked-in type file is provided because local development does not
require the Supabase CLI or a linked hosted project.
