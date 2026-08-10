-- Core gradebook: Jan/Jadon-managed assignments and per-student entries.
-- FastAPI service role only; no browser policies.

create table if not exists public.grade_assignments (
  id uuid primary key,
  title text not null,
  description text,
  category_id text not null,
  assignment_type text not null default 'custom',
  points_possible double precision not null default 10,
  event_id uuid references public.events (id) on delete set null,
  committee_id uuid references public.committees (id) on delete set null,
  available_at timestamptz,
  due_at timestamptz,
  late_due_at timestamptz,
  created_by_user_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.grade_entries (
  id uuid primary key,
  assignment_id uuid not null references public.grade_assignments (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'not_started',
  score double precision,
  publication_status text not null default 'draft',
  submitted_at timestamptz,
  graded_at timestamptz,
  published_at timestamptz,
  graded_by_user_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assignment_id, student_id)
);

create index if not exists grade_entries_student_id_idx
  on public.grade_entries (student_id);

create index if not exists grade_entries_assignment_id_idx
  on public.grade_entries (assignment_id);

alter table public.grade_assignments enable row level security;
alter table public.grade_entries enable row level security;
