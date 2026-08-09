-- Note Taker: meeting sessions, raw transcripts, and generated meeting notes.
-- Audio blobs live in ObjectStorage under opaque keys; only the key is stored here.

create table if not exists public.meeting_sessions (
    id uuid primary key default gen_random_uuid(),
    created_by uuid not null references public.profiles (id) on delete cascade,
    title text not null,
    status text not null default 'recording'
        check (status in ('recording', 'uploading', 'processing', 'ready', 'failed')),
    audio_storage_key text,
    audio_content_type text,
    audio_size_bytes bigint,
    duration_ms integer,
    error_message text,
    event_id uuid references public.events (id) on delete set null,
    started_at timestamptz not null default now(),
    ended_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists meeting_sessions_created_by_idx
    on public.meeting_sessions (created_by, created_at desc);

create table if not exists public.meeting_transcripts (
    session_id uuid primary key
        references public.meeting_sessions (id) on delete cascade,
    full_text text not null default '',
    segments_json text not null default '[]',
    language text,
    provider text not null default 'whisper-local',
    created_at timestamptz not null default now()
);

create table if not exists public.meeting_notes (
    session_id uuid primary key
        references public.meeting_sessions (id) on delete cascade,
    title text not null,
    summary text not null default '',
    sections_json text not null default '[]',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

insert into public.permissions (key, description, category)
values
    (
        'note_taker.view',
        'View own Note Taker meeting sessions',
        'note_taker'
    ),
    (
        'note_taker.record',
        'Record and upload Note Taker sessions',
        'note_taker'
    ),
    (
        'note_taker.manage',
        'View any Note Taker session',
        'note_taker'
    )
on conflict (key) do update
set
    description = excluded.description,
    category = excluded.category;

-- Members (and roles that inherit the member baseline) may view + record.
insert into public.role_permissions (role_id, permission_id, effect)
select r.id, p.id, 'allow'
from public.roles r
cross join public.permissions p
where r.slug = 'member'
  and p.key in ('note_taker.view', 'note_taker.record')
on conflict (role_id, permission_id) do nothing;

-- Ops: manage + view/record for ASBO / AC / President.
insert into public.role_permissions (role_id, permission_id, effect)
select r.id, p.id, 'allow'
from public.roles r
cross join public.permissions p
where r.slug in ('asbo', 'ac', 'president')
  and p.key in ('note_taker.view', 'note_taker.record', 'note_taker.manage')
on conflict (role_id, permission_id) do nothing;
