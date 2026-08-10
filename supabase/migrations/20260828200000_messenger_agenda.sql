-- Messenger Agenda tool: keyword-triggered chat capture → meeting agenda.

create table if not exists public.messenger_agenda_sessions (
    id uuid primary key default gen_random_uuid(),
    created_by uuid not null references public.profiles (id) on delete cascade,
    title text not null default 'Messenger agenda',
    status text not null default 'idle'
        check (status in ('idle', 'capturing', 'finalized')),
    source text not null default 'paste'
        check (source in ('paste', 'messenger')),
    thread_id text,
    thread_label text,
    start_keyword text not null default 'agenda start',
    end_keyword text not null default 'agenda end',
    raw_text text not null default '',
    captured_text text not null default '',
    agenda_json text not null default '{}',
    assignments_json text not null default '[]',
    plan_id text,
    capturing_started_at timestamptz,
    finalized_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists messenger_agenda_sessions_created_by_idx
    on public.messenger_agenda_sessions (created_by, created_at desc);

create table if not exists public.messenger_connections (
    id uuid primary key default gen_random_uuid(),
    profile_id uuid not null unique references public.profiles (id) on delete cascade,
    status text not null default 'disconnected'
        check (status in ('disconnected', 'connected')),
    granted_threads_json text not null default '[]',
    access_token_enc text,
    connected_at timestamptz,
    updated_at timestamptz not null default now()
);

insert into public.permissions (key, description, category)
values
    (
        'messenger_agenda.view',
        'View own Messenger Agenda sessions',
        'messenger_agenda'
    ),
    (
        'messenger_agenda.ingest',
        'Connect Messenger chats and capture agendas',
        'messenger_agenda'
    ),
    (
        'messenger_agenda.manage',
        'View any Messenger Agenda session',
        'messenger_agenda'
    )
on conflict (key) do update
set
    description = excluded.description,
    category = excluded.category;

insert into public.role_permissions (role_id, permission_id, effect)
select r.id, p.id, 'allow'
from public.roles r
cross join public.permissions p
where r.slug = 'member'
  and p.key in ('messenger_agenda.view', 'messenger_agenda.ingest')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id, effect)
select r.id, p.id, 'allow'
from public.roles r
cross join public.permissions p
where r.slug in ('asbo', 'ac', 'president')
  and p.key in (
      'messenger_agenda.view',
      'messenger_agenda.ingest',
      'messenger_agenda.manage'
  )
on conflict do nothing;
