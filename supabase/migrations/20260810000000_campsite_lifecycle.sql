-- Campsite lifecycle: archiving, and a serialisation point for admin changes.
--
-- Break Camp archives rather than deletes. Archiving is reversible by someone
-- with database access, deletion is not, and a student organisation losing a
-- year of debriefs to a mistyped confirmation is not a recoverable situation.

alter table public.campsite_settings
    add column if not exists archived_at timestamptz,
    add column if not exists archived_by uuid references public.profiles(id) on delete set null,
    add column if not exists archived_reason text;

comment on column public.campsite_settings.archived_at is
    'Set by Break Camp. Non-null means the Campsite is read-only for everyone.';

-- ---------------------------------------------------------------------------
-- Advisory lock helper for administrator changes
-- ---------------------------------------------------------------------------

-- The last-admin trigger counts remaining administrators, which is a
-- read-then-write: two concurrent transactions can each see two admins, each
-- remove one, and leave zero. Row locks do not help, because the rows being
-- counted are not the rows being deleted.
--
-- Every operation that adds or removes a superadmin takes this lock first, so
-- they serialise against each other. It is transaction-scoped, so it is
-- released on commit or rollback without any cleanup.
create or replace function public.lock_admin_changes()
returns void
language sql
security definer
set search_path = ''
as $$
    -- A fixed, arbitrary key; only its uniqueness within this database matters.
    select pg_advisory_xact_lock(hashtext('l2hub.superadmin_roster'));
$$;

comment on function public.lock_admin_changes() is
    'Serialises superadmin add/remove so the last-admin check cannot be raced.';

grant execute on function public.lock_admin_changes() to authenticated;

-- ---------------------------------------------------------------------------
-- Archived Campsites are read-only
-- ---------------------------------------------------------------------------

-- Once archived, settings stop being writable even for an administrator. The
-- way back is through the database, deliberately: un-archiving should be a
-- considered act, not a button someone can hit twice.
drop policy if exists campsite_settings_update on public.campsite_settings;
create policy campsite_settings_update
    on public.campsite_settings
    for update
    to authenticated
    using (
        public.current_user_has_permission('settings.edit')
        and archived_at is null
    )
    with check (public.current_user_has_permission('settings.edit'));
