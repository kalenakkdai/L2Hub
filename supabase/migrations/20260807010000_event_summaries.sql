-- Event Summary / Wrapped domain tables.

create table if not exists public.events (
    id                     uuid primary key default gen_random_uuid(),
    name                   text not null,
    slug                   text not null unique,
    year                   integer not null,
    status                 text not null default 'scheduled',
    managing_committee_id  uuid references public.committees(id) on delete set null,
    starts_at              timestamptz,
    ends_at                timestamptz,
    created_at             timestamptz not null default now()
);

create table if not exists public.event_summaries (
    id               uuid primary key default gen_random_uuid(),
    event_id         uuid not null unique references public.events(id) on delete cascade,
    status           text not null default 'not_requested',
    generation_stage text,
    payload_json     text,
    published_at     timestamptz,
    published_by     uuid references public.profiles(id) on delete set null,
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now()
);

create table if not exists public.event_summary_requests (
    id           uuid primary key default gen_random_uuid(),
    event_id     uuid not null references public.events(id) on delete cascade,
    requested_by uuid not null references public.profiles(id) on delete cascade,
    status       text not null default 'pending',
    note         text,
    reviewed_by  uuid references public.profiles(id) on delete set null,
    reviewed_at  timestamptz,
    created_at   timestamptz not null default now()
);

create table if not exists public.event_agendas (
    id           uuid primary key default gen_random_uuid(),
    event_id     uuid not null references public.events(id) on delete cascade,
    summary_id   uuid references public.event_summaries(id) on delete set null,
    content_json text not null default '{}',
    status       text not null default 'draft',
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now()
);

create table if not exists public.notifications (
    id                 uuid primary key default gen_random_uuid(),
    recipient_user_id  uuid not null references public.profiles(id) on delete cascade,
    type               text not null,
    title              text not null,
    body               text not null default '',
    payload_json       text,
    read_at            timestamptz,
    created_at         timestamptz not null default now()
);

create index if not exists notifications_recipient_idx
    on public.notifications (recipient_user_id, created_at desc);

create table if not exists public.debrief_participants (
    id            uuid primary key default gen_random_uuid(),
    event_id      uuid not null references public.events(id) on delete cascade,
    user_id       uuid references public.profiles(id) on delete set null,
    display_name  text not null,
    status        text not null default 'not_started',
    submitted_at  timestamptz
);

create index if not exists debrief_participants_event_idx
    on public.debrief_participants (event_id);
