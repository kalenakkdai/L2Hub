-- Discord-inspired RBAC: system roles, permissions, scopes, committees, audit.
-- Renames legacy profile roles: student→member, officer→asbo, adviser→ac.

-- ---------------------------------------------------------------------------
-- Expand / remap user_role enum
-- ---------------------------------------------------------------------------

alter type public.user_role add value if not exists 'member';
alter type public.user_role add value if not exists 'asbo';
alter type public.user_role add value if not exists 'ac';

-- New enum values cannot be used in the same transaction they are added in
-- some Postgres versions. Prefer a dedicated remap migration if needed.
-- For local/dev, continue with text-compatible updates via cast after commit.

-- ---------------------------------------------------------------------------
-- Profile columns for admin roster
-- ---------------------------------------------------------------------------

alter table public.profiles
    add column if not exists status text not null default 'active',
    add column if not exists last_active_at timestamptz;

comment on column public.profiles.status is
    'Account status: active | deactivated. Synthetic preview users are never stored here.';

-- ---------------------------------------------------------------------------
-- Core RBAC tables
-- ---------------------------------------------------------------------------

create table if not exists public.roles (
    id            uuid primary key default gen_random_uuid(),
    name          text not null,
    slug          text not null unique,
    rank          integer not null,
    is_system     boolean not null default false,
    is_assignable boolean not null default true,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);

create table if not exists public.permissions (
    id          uuid primary key default gen_random_uuid(),
    key         text not null unique,
    description text not null default '',
    category    text not null default 'general'
);

create table if not exists public.role_permissions (
    id            uuid primary key default gen_random_uuid(),
    role_id       uuid not null references public.roles(id) on delete cascade,
    permission_id uuid not null references public.permissions(id) on delete cascade,
    effect        text not null default 'allow' check (effect in ('allow', 'deny', 'inherit')),
    unique (role_id, permission_id)
);

create table if not exists public.committees (
    id         uuid primary key default gen_random_uuid(),
    slug       text not null unique,
    name       text not null,
    created_at timestamptz not null default now()
);

create table if not exists public.user_roles (
    id           uuid primary key default gen_random_uuid(),
    user_id      uuid not null references public.profiles(id) on delete cascade,
    role_id      uuid not null references public.roles(id) on delete cascade,
    committee_id uuid references public.committees(id) on delete cascade,
    event_id     uuid,
    starts_at    timestamptz,
    ends_at      timestamptz,
    created_at   timestamptz not null default now()
);

create index if not exists user_roles_user_idx on public.user_roles (user_id);
create index if not exists user_roles_committee_idx on public.user_roles (committee_id);

create table if not exists public.permission_overrides (
    id                 uuid primary key default gen_random_uuid(),
    user_id            uuid references public.profiles(id) on delete cascade,
    role_id            uuid references public.roles(id) on delete cascade,
    permission_id      uuid not null references public.permissions(id) on delete cascade,
    committee_id       uuid references public.committees(id) on delete cascade,
    event_id           uuid,
    effect             text not null check (effect in ('allow', 'deny')),
    reason             text,
    created_by_user_id uuid references public.profiles(id) on delete set null,
    created_at         timestamptz not null default now()
);

create table if not exists public.committee_memberships (
    id              uuid primary key default gen_random_uuid(),
    user_id         uuid not null references public.profiles(id) on delete cascade,
    committee_id    uuid not null references public.committees(id) on delete cascade,
    membership_type text not null default 'member',
    is_head         boolean not null default false,
    created_at      timestamptz not null default now(),
    unique (user_id, committee_id)
);

create table if not exists public.audit_logs (
    id            uuid primary key default gen_random_uuid(),
    actor_user_id uuid references public.profiles(id) on delete set null,
    action        text not null,
    target_type   text not null,
    target_id     text,
    metadata_json text,
    created_at    timestamptz not null default now()
);

create index if not exists audit_logs_actor_idx on public.audit_logs (actor_user_id);
create index if not exists audit_logs_created_idx on public.audit_logs (created_at desc);

-- ---------------------------------------------------------------------------
-- Staff helper remap (legacy names still accepted until data migrated)
-- ---------------------------------------------------------------------------

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select public.current_user_role()::text in ('officer', 'adviser', 'asbo', 'ac');
$$;

-- Signup still creates the least-privileged role. Prefer member when available.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    default_role text := 'student';
begin
    if exists (
        select 1
        from pg_enum e
        join pg_type t on t.oid = e.enumtypid
        where t.typname = 'user_role' and e.enumlabel = 'member'
    ) then
        default_role := 'member';
    end if;

    insert into public.profiles (id, email, full_name, role, status)
    values (
        new.id,
        new.email,
        nullif(new.raw_user_meta_data ->> 'full_name', ''),
        default_role::public.user_role,
        'active'
    )
    on conflict (id) do nothing;

    return new;
end;
$$;
