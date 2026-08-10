-- Public photographer photo drop (Drive links + optional file uploads).

create table if not exists public.photographer_submissions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  credit_name text not null,
  social_media_url text not null default '',
  permission text not null,
  drive_url text,
  storage_key text,
  content_type text,
  size_bytes integer,
  notes text not null default '',
  photographer_name text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists photographer_submissions_event_id_idx
  on public.photographer_submissions (event_id);

create index if not exists photographer_submissions_created_at_idx
  on public.photographer_submissions (created_at desc);

alter table public.photographer_submissions enable row level security;
-- No browser policies: only the FastAPI service role writes/reads rows.
