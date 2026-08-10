-- Member-authored assignment proposals reviewed by Jan/Jadon.

create table if not exists public.grade_assignment_requests (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  description text,
  proposed_category_id text not null,
  proposed_points double precision not null check (proposed_points > 0),
  committee_id uuid references public.committees (id) on delete set null,
  submitted_by_user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  reviewed_by_user_id uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_assignment_id uuid references public.grade_assignments (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists grade_assignment_requests_submitter_idx
  on public.grade_assignment_requests (submitted_by_user_id, created_at desc);

create index if not exists grade_assignment_requests_pending_idx
  on public.grade_assignment_requests (created_at)
  where status = 'pending';

alter table public.grade_assignment_requests enable row level security;
-- FastAPI service role only; no browser policies.
