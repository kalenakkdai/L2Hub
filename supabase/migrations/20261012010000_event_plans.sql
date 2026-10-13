-- Event planning boards. Reports store an author for accountability, but the
-- API redacts that column. No browser policies: the service role is the reader.

create table if not exists public.event_plans (
    id uuid primary key,
    title text not null,
    summary text not null default '',
    event_date date,
    status text not null default 'draft'
        check (status in ('draft', 'pending_enablement', 'enabled', 'active', 'completed')),
    created_by_user_id uuid not null references public.profiles (id) on delete cascade,
    enabled_by_user_id uuid references public.profiles (id) on delete set null,
    enabled_at timestamptz,
    agenda_json text not null default '{}',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.event_plan_assignments (
    id uuid primary key,
    plan_id uuid not null references public.event_plans (id) on delete cascade,
    target_type text not null check (target_type in ('committee', 'individual')),
    committee_id uuid references public.committees (id) on delete set null,
    member_user_id uuid references public.profiles (id) on delete set null,
    role_label text not null,
    status text not null default 'invited'
        check (status in ('invited', 'accepted', 'declined'))
);

create table if not exists public.event_plan_reports (
    id uuid primary key,
    plan_id uuid not null references public.event_plans (id) on delete cascade,
    author_user_id uuid not null references public.profiles (id) on delete cascade,
    subject_user_id uuid not null references public.profiles (id) on delete cascade,
    category text not null,
    details text not null,
    attachments_json text not null default '[]',
    created_at timestamptz not null default now()
);

alter table public.event_plans enable row level security;
alter table public.event_plan_assignments enable row level security;
alter table public.event_plan_reports enable row level security;
