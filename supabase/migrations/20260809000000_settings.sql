-- Settings: camper preferences, notification routing, and Campsite configuration.
--
-- Three things worth knowing about the shape here:
--
--   1. campsite_settings is a singleton. There is no campsites table and every
--      other table in this schema is single-tenant, so a campsite_id foreign
--      key would buy a reference and no actual isolation. A check constraint
--      pins it to one row; adding real multi-tenancy later is a migration.
--
--   2. profiles.display_name is an optional override, not a replacement for
--      full_name. full_name is the name captured at signup and used to greet
--      the camper; display_name is what they would rather be called.
--
--   3. Nothing here trusts the UI. Every table gets RLS, and the last-admin
--      rule is a trigger on user_roles rather than a check in a form handler.

-- ---------------------------------------------------------------------------
-- profiles: personal details and preferences
-- ---------------------------------------------------------------------------

alter table public.profiles
    add column if not exists display_name         text,
    add column if not exists pronouns             text,
    add column if not exists grade_year           integer,
    add column if not exists avatar_url           text,
    add column if not exists phone                text,
    add column if not exists phone_verified       boolean not null default false,
    add column if not exists email_verified       boolean not null default false,
    add column if not exists theme                text    not null default 'system',
    add column if not exists reduce_motion        boolean not null default false,
    add column if not exists compact_density      boolean not null default false,
    add column if not exists quiet_hours_start    time,
    add column if not exists quiet_hours_end      time,
    add column if not exists notifications_paused boolean not null default false;

do $$
begin
    if not exists (
        select 1 from pg_constraint where conname = 'profiles_theme_check'
    ) then
        alter table public.profiles
            add constraint profiles_theme_check
            check (theme in ('system', 'light', 'dark'));
    end if;

    -- A Leadership class spans four grades. Bounds keep a typo out of the UI.
    if not exists (
        select 1 from pg_constraint where conname = 'profiles_grade_year_check'
    ) then
        alter table public.profiles
            add constraint profiles_grade_year_check
            check (grade_year is null or grade_year between 9 and 12);
    end if;
end;
$$;

comment on column public.profiles.display_name is
    'Optional override for how a camper is addressed. full_name remains the name captured at signup.';
comment on column public.profiles.email_verified is
    'Mirrors auth.users.email_confirmed_at, synced by the trigger below. Never written by a client.';

-- Changing a verified address or number drops verification. Enforced here so
-- it holds regardless of which client performed the update.
create or replace function public.reset_verification_on_contact_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
    if new.phone is distinct from old.phone then
        new.phone_verified := false;
    end if;

    if new.email is distinct from old.email then
        new.email_verified := false;
    end if;

    return new;
end;
$$;

drop trigger if exists profiles_reset_verification on public.profiles;
create trigger profiles_reset_verification
    before update on public.profiles
    for each row
    execute function public.reset_verification_on_contact_change();

-- Supabase owns verification. `supabase.auth.verifyOtp` and the email
-- confirmation flow stamp auth.users; this mirrors that into profiles so the
-- UI has one place to read from. Without it the Verified chip could never
-- flip, because clients are forbidden from setting the flags themselves.
create or replace function public.sync_verification_from_auth()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    update public.profiles
    set email          = coalesce(new.email, email),
        email_verified = new.email_confirmed_at is not null,
        phone          = coalesce(new.phone, phone),
        phone_verified = new.phone_confirmed_at is not null
    where id = new.id;

    return new;
end;
$$;

drop trigger if exists on_auth_user_verified on auth.users;
create trigger on_auth_user_verified
    after update of email, phone, email_confirmed_at, phone_confirmed_at
    on auth.users
    for each row
    execute function public.sync_verification_from_auth();

-- Backfill for accounts that confirmed before this migration.
update public.profiles p
set email_verified = u.email_confirmed_at is not null,
    phone          = coalesce(u.phone, p.phone),
    phone_verified = u.phone_confirmed_at is not null
from auth.users u
where u.id = p.id;

-- ---------------------------------------------------------------------------
-- notification_preferences: one row per camper, event type, and channel
-- ---------------------------------------------------------------------------

create table if not exists public.notification_preferences (
    id         uuid primary key default gen_random_uuid(),
    profile_id uuid not null references public.profiles(id) on delete cascade,
    event_type text not null check (event_type in (
        'task_assigned',
        'task_due_soon',
        'task_overdue',
        'event_created',
        'event_starting',
        'crew_announcement',
        'points_awarded',
        'level_up'
    )),
    channel    text not null check (channel in ('email', 'sms', 'in_app')),
    enabled    boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (profile_id, event_type, channel)
);

create index if not exists notification_preferences_profile_idx
    on public.notification_preferences (profile_id);

-- `crew_announcement` keeps the event-type name from the product spec even
-- though this codebase calls the group a committee. Renaming it is a data
-- migration on existing rows, so it is left alone deliberately.
comment on column public.notification_preferences.event_type is
    'crew_announcement refers to a committee announcement; the name is retained for compatibility.';

-- ---------------------------------------------------------------------------
-- campsite_settings: singleton
-- ---------------------------------------------------------------------------

create table if not exists public.campsite_settings (
    id                uuid primary key default gen_random_uuid(),
    -- Pinned to a single row. See the note at the top of this file.
    singleton         boolean not null default true unique
                      check (singleton),
    name              text not null default 'L2 Campsite',
    tagline           text,
    category          text,
    icon              text,
    accent_color      text not null default '#12372A',
    modules_enabled   jsonb not null default jsonb_build_object(
        'grades', true,
        'events', true,
        'debriefs', true,
        'committees', true,
        'wrapped', true
    ),
    join_code         text unique,
    requires_approval boolean not null default true,
    is_public         boolean not null default true,
    points_config     jsonb not null default jsonb_build_object(
        'debrief_submitted', 20,
        'event_attended', 10,
        'task_completed', 5,
        'points_per_level', 200
    ),
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now()
);

insert into public.campsite_settings (name)
values ('L2 Campsite')
on conflict (singleton) do nothing;

-- ---------------------------------------------------------------------------
-- settings.edit permission
-- ---------------------------------------------------------------------------

insert into public.permissions (key, description, category)
values
    ('settings.edit', 'Edit Campsite settings', 'admin'),
    ('settings.view', 'View Campsite settings', 'admin')
on conflict (key) do nothing;

-- Superadmins get both. They already hold every permission by the cross join
-- in the RBAC migration, but that ran before these keys existed.
insert into public.role_permissions (role_id, permission_id, effect)
select r.id, p.id, 'allow'
from public.roles r
cross join public.permissions p
where r.slug in ('ac', 'president')
  and p.key in ('settings.edit', 'settings.view')
on conflict (role_id, permission_id) do nothing;

-- Advisers (ASBO) may look but not touch.
insert into public.role_permissions (role_id, permission_id, effect)
select r.id, p.id, 'allow'
from public.roles r
join public.permissions p on p.key = 'settings.view'
where r.slug = 'asbo'
on conflict (role_id, permission_id) do nothing;

-- ---------------------------------------------------------------------------
-- Last-admin protection
-- ---------------------------------------------------------------------------

-- Removing or expiring the final superadmin would leave the Campsite with
-- nobody able to administer it, and no way back in through the UI. Enforced on
-- the table so it holds for every client, including psql.
create or replace function public.prevent_last_admin_removal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    removed_slug text;
    remaining    integer;
begin
    select r.slug into removed_slug
    from public.roles r
    where r.id = old.role_id;

    if removed_slug is null or removed_slug not in ('ac', 'president') then
        return old;
    end if;

    select count(distinct ur.user_id) into remaining
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where r.slug in ('ac', 'president')
      and ur.id <> old.id
      and (ur.ends_at is null or ur.ends_at > now());

    if remaining = 0 then
        raise exception
            'Cannot remove the last administrator. Assign another AC or President first.'
            using errcode = 'restrict_violation';
    end if;

    return old;
end;
$$;

drop trigger if exists user_roles_prevent_last_admin on public.user_roles;
create trigger user_roles_prevent_last_admin
    before delete on public.user_roles
    for each row
    execute function public.prevent_last_admin_removal();

-- Expiring the assignment is deletion by another name, so it is blocked too.
create or replace function public.prevent_last_admin_expiry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    role_slug text;
    remaining integer;
begin
    -- Only an update that ends or reassigns the role can orphan the Campsite.
    if new.role_id = old.role_id
       and (new.ends_at is null or new.ends_at > now())
    then
        return new;
    end if;

    select r.slug into role_slug from public.roles r where r.id = old.role_id;

    if role_slug is null or role_slug not in ('ac', 'president') then
        return new;
    end if;

    select count(distinct ur.user_id) into remaining
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where r.slug in ('ac', 'president')
      and ur.id <> old.id
      and (ur.ends_at is null or ur.ends_at > now());

    if remaining = 0 then
        raise exception
            'Cannot remove the last administrator. Assign another AC or President first.'
            using errcode = 'restrict_violation';
    end if;

    return new;
end;
$$;

drop trigger if exists user_roles_prevent_last_admin_expiry on public.user_roles;
create trigger user_roles_prevent_last_admin_expiry
    before update on public.user_roles
    for each row
    execute function public.prevent_last_admin_expiry();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.notification_preferences enable row level security;
alter table public.campsite_settings enable row level security;

-- Notification preferences are private. A camper reads and writes their own
-- and nobody else's — there is no staff override, because no feature needs to
-- read someone else's notification routing.
drop policy if exists notification_preferences_select_own on public.notification_preferences;
create policy notification_preferences_select_own
    on public.notification_preferences
    for select
    to authenticated
    using ((select auth.uid()) = profile_id);

drop policy if exists notification_preferences_insert_own on public.notification_preferences;
create policy notification_preferences_insert_own
    on public.notification_preferences
    for insert
    to authenticated
    with check ((select auth.uid()) = profile_id);

drop policy if exists notification_preferences_update_own on public.notification_preferences;
create policy notification_preferences_update_own
    on public.notification_preferences
    for update
    to authenticated
    using ((select auth.uid()) = profile_id)
    with check ((select auth.uid()) = profile_id);

drop policy if exists notification_preferences_delete_own on public.notification_preferences;
create policy notification_preferences_delete_own
    on public.notification_preferences
    for delete
    to authenticated
    using ((select auth.uid()) = profile_id);

-- Campsite settings are readable by anyone signed in — the accent colour and
-- module toggles drive the whole UI — but writable only with settings.edit.
drop policy if exists campsite_settings_select on public.campsite_settings;
create policy campsite_settings_select
    on public.campsite_settings
    for select
    to authenticated
    using (true);

drop policy if exists campsite_settings_update on public.campsite_settings;
create policy campsite_settings_update
    on public.campsite_settings
    for update
    to authenticated
    using (public.current_user_has_permission('settings.edit'))
    with check (public.current_user_has_permission('settings.edit'));

-- No insert or delete policy: the singleton is created by this migration and
-- is not meant to be recreated or removed by a client.

grant select, insert, update, delete on public.notification_preferences to authenticated;
grant select, update on public.campsite_settings to authenticated;

-- ---------------------------------------------------------------------------
-- profiles: tighten self-write now that the table carries preferences
-- ---------------------------------------------------------------------------

-- A camper may edit their own row. Verification flags are excluded: they are
-- set by the trigger above and by the auth sync, never by the client, so a
-- camper cannot mark their own phone verified by writing the column directly.
create or replace function public.prevent_self_verification()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
    if (select auth.uid()) is distinct from new.id then
        return new;
    end if;

    -- Turning verification off is always allowed; turning it on is not.
    if new.phone_verified and not old.phone_verified then
        new.phone_verified := old.phone_verified;
    end if;

    if new.email_verified and not old.email_verified then
        new.email_verified := old.email_verified;
    end if;

    return new;
end;
$$;

drop trigger if exists profiles_prevent_self_verification on public.profiles;
create trigger profiles_prevent_self_verification
    before update on public.profiles
    for each row
    execute function public.prevent_self_verification();
