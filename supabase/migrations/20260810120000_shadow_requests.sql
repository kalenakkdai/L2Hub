-- Baby campers may request temporary head-level visibility ("shadow").
-- Heads accept or deny; an approved grant elevates view permissions until ends_at.

create table if not exists public.shadow_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  committee_id uuid not null references public.committees (id) on delete cascade,
  duration_minutes integer not null check (duration_minutes > 0 and duration_minutes <= 10080),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'denied', 'cancelled', 'expired')),
  message text,
  reviewed_by_id uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists shadow_requests_requester_idx
  on public.shadow_requests (requester_id, status);

create index if not exists shadow_requests_committee_idx
  on public.shadow_requests (committee_id, status);

create index if not exists shadow_requests_active_idx
  on public.shadow_requests (requester_id, ends_at)
  where status = 'approved';

alter table public.shadow_requests enable row level security;

-- App reads/writes through the FastAPI service role / backend session.
grant select, insert, update, delete on public.shadow_requests to authenticated;
grant all on public.shadow_requests to service_role;
