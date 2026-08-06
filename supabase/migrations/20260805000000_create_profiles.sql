-- Profiles: one row per auth.users row, holding L2 Hub application identity.
--
-- Auth itself stays in Supabase's auth schema. This table adds the app-level
-- fields we own: display name and role. Every user gets a profile
-- automatically when they sign up, via a trigger on auth.users.

-- ---------------------------------------------------------------------------
-- Role enum
-- ---------------------------------------------------------------------------

-- Declared least-privileged first. Postgres orders enum values by declaration
-- order, so comparisons like `role >= 'officer'` express seniority directly.
create type public.user_role as enum (
    'student',
    'committee_head',
    'officer',
    'adviser'
);

-- ---------------------------------------------------------------------------
-- profiles table
-- ---------------------------------------------------------------------------

create table public.profiles (
    id          uuid primary key references auth.users (id) on delete cascade,
    email       text        not null,
    full_name   text,
    role        public.user_role not null default 'student',
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

comment on table public.profiles is
    'Application profile for each auth.users row. Created automatically on signup.';
comment on column public.profiles.role is
    'Authorization role: student | committee_head | officer | adviser. Everyone signs up as student; only service-role callers may change it (see prevent_role_self_change).';

create index profiles_role_idx on public.profiles (role);

-- ---------------------------------------------------------------------------
-- Keep updated_at honest
-- ---------------------------------------------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

create trigger profiles_set_updated_at
    before update on public.profiles
    for each row
    execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Auto-create a profile whenever a user signs up
-- ---------------------------------------------------------------------------

-- security definer so it can write to public.profiles regardless of the
-- (unprivileged) role that triggered the signup. search_path is pinned to
-- empty and every reference is schema-qualified, which is the documented
-- way to keep a definer function from being hijacked via search_path.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    -- Everyone starts as a student. raw_user_meta_data is supplied by the
    -- client at signup, so honouring a role from it would let anyone register
    -- as an adviser. Elevated roles are granted afterwards by staff.
    insert into public.profiles (id, email, full_name, role)
    values (
        new.id,
        new.email,
        nullif(new.raw_user_meta_data ->> 'full_name', ''),
        'student'::public.user_role
    )
    on conflict (id) do nothing;

    return new;
end;
$$;

create trigger on_auth_user_created
    after insert on auth.users
    for each row
    execute function public.handle_new_user();

-- Backfill any users that already existed before this migration ran.
insert into public.profiles (id, email, full_name)
select
    u.id,
    u.email,
    nullif(u.raw_user_meta_data ->> 'full_name', '')
from auth.users u
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Role lookup helper
-- ---------------------------------------------------------------------------

-- Reading profiles from inside a profiles policy would recurse. A security
-- definer function bypasses RLS, which breaks the cycle.
create function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
    select role from public.profiles where id = (select auth.uid());
$$;

-- Roles allowed to read the whole roster.
--
-- committee_head is deliberately NOT included. A committee head should see
-- their own committee's members, not every user — and there is no committees
-- table yet to scope that against. Granting it now would be broader than
-- intended and awkward to walk back. Revisit when committees land.
create function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select public.current_user_role() in ('officer', 'adviser');
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;

-- Everyone can read their own profile.
create policy profiles_select_own
    on public.profiles
    for select
    to authenticated
    using ((select auth.uid()) = id);

-- Officers and advisers can read every profile (rosters, dashboards).
create policy profiles_select_staff
    on public.profiles
    for select
    to authenticated
    using (public.is_staff());

-- Users may edit their own profile. The with check clause re-asserts
-- ownership so a row cannot be reassigned to someone else.
create policy profiles_update_own
    on public.profiles
    for update
    to authenticated
    using ((select auth.uid()) = id)
    with check ((select auth.uid()) = id);

-- No insert or delete policy for authenticated users: rows are created by the
-- signup trigger and removed by the cascade from auth.users.

-- ---------------------------------------------------------------------------
-- Block role self-promotion
-- ---------------------------------------------------------------------------

-- profiles_update_own would otherwise let a student set their own role to
-- 'adviser'. Postgres has no column-level RLS, so enforce it in a trigger.
-- The service role (used by the FastAPI backend) bypasses RLS but not
-- triggers, so it is exempted explicitly.
create function public.prevent_role_self_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
    if new.role is distinct from old.role
       and coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
    then
        raise exception 'Only staff may change a profile role'
            using errcode = 'insufficient_privilege';
    end if;

    return new;
end;
$$;

create trigger profiles_prevent_role_self_change
    before update on public.profiles
    for each row
    execute function public.prevent_role_self_change();

-- ---------------------------------------------------------------------------
-- Grants (RLS still applies on top of these)
-- ---------------------------------------------------------------------------

grant select, update on public.profiles to authenticated;
