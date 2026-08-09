-- Reusable Note Taker log placements: one meeting can sit under many event fires.

create table if not exists public.meeting_session_event_links (
    id uuid primary key default gen_random_uuid(),
    session_id uuid not null
        references public.meeting_sessions (id) on delete cascade,
    event_id uuid not null
        references public.events (id) on delete cascade,
    linked_by uuid not null
        references public.profiles (id) on delete cascade,
    created_at timestamptz not null default now(),
    unique (session_id, event_id)
);

create index if not exists meeting_session_event_links_event_idx
    on public.meeting_session_event_links (event_id, created_at desc);

create index if not exists meeting_session_event_links_session_idx
    on public.meeting_session_event_links (session_id);

-- Backfill: record-time event_id becomes an explicit fire placement.
insert into public.meeting_session_event_links (session_id, event_id, linked_by, created_at)
select
    s.id,
    s.event_id,
    s.created_by,
    coalesce(s.created_at, now())
from public.meeting_sessions s
where s.event_id is not null
on conflict (session_id, event_id) do nothing;

alter table public.meeting_session_event_links enable row level security;
revoke all on public.meeting_session_event_links from authenticated;

comment on table public.meeting_session_event_links is
    'Many-to-many placements of a Note Taker meeting (log) under event campfires. FastAPI-only writes.';
