-- Daily attendance, scan identities, whereabouts map, and delivery outboxes.
-- All access goes through FastAPI permission checks; direct client access stays
-- denied because these rows contain student and parent contact data.

create table if not exists public.attendance_identities (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  student_id_digest text unique,
  student_id_last4 text,
  parent_email text,
  parent_phone text,
  passkey_opt_in boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attendance_identity_last4 check (
    student_id_last4 is null or length(student_id_last4) <= 4
  )
);

create table if not exists public.attendance_days (
  id uuid primary key default gen_random_uuid(),
  school_date date not null unique,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'open'
    check (status in ('open', 'closed')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint attendance_day_window check (ends_at > starts_at)
);

create table if not exists public.attendance_passkeys (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  credential_id bytea not null unique,
  public_key bytea not null,
  sign_count integer not null default 0,
  device_name text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create table if not exists public.attendance_passkey_challenges (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  day_id uuid references public.attendance_days(id) on delete cascade,
  purpose text not null check (purpose in ('registration', 'authentication')),
  challenge bytea not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references public.attendance_days(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  checked_in_at timestamptz,
  check_in_source text check (
    check_in_source is null or check_in_source in ('barcode', 'keypad', 'passkey', 'manual')
  ),
  late boolean not null default false,
  score_percent integer not null default 0 check (score_percent between 0 and 100),
  present_percent double precision not null default 0
    check (present_percent between 0 and 100),
  status text not null default 'absent'
    check (status in ('present', 'late', 'absent', 'excused', 'under_80')),
  manual_note text,
  edited_by uuid references public.profiles(id) on delete set null,
  edited_at timestamptz,
  parent_alert_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (day_id, profile_id)
);

create index if not exists attendance_records_day_idx
  on public.attendance_records(day_id);
create index if not exists attendance_records_profile_idx
  on public.attendance_records(profile_id);

create table if not exists public.whereabouts_entries (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  display_name text not null,
  kind text not null check (kind in ('bathroom', 'errand')),
  destination_key text not null,
  custom_destination text,
  task_name text,
  left_at timestamptz not null,
  returned_at timestamptz,
  initiated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists whereabouts_active_idx
  on public.whereabouts_entries(returned_at, left_at);
create unique index if not exists whereabouts_one_active_per_student_idx
  on public.whereabouts_entries(profile_id)
  where returned_at is null and profile_id is not null;

create table if not exists public.whereabouts_pings (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.whereabouts_entries(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict,
  message text not null,
  channel text not null default 'in_app',
  delivery_status text not null default 'queued',
  created_at timestamptz not null default now()
);

create table if not exists public.parent_alerts (
  id uuid primary key default gen_random_uuid(),
  attendance_record_id uuid not null unique
    references public.attendance_records(id) on delete cascade,
  recipient_email text not null,
  subject text not null,
  body text not null,
  status text not null default 'queued'
    check (status in ('queued', 'sent', 'failed')),
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.attendance_identities enable row level security;
alter table public.attendance_days enable row level security;
alter table public.attendance_passkeys enable row level security;
alter table public.attendance_passkey_challenges enable row level security;
alter table public.attendance_records enable row level security;
alter table public.whereabouts_entries enable row level security;
alter table public.whereabouts_pings enable row level security;
alter table public.parent_alerts enable row level security;

revoke all on public.attendance_identities from anon, authenticated;
revoke all on public.attendance_days from anon, authenticated;
revoke all on public.attendance_passkeys from anon, authenticated;
revoke all on public.attendance_passkey_challenges from anon, authenticated;
revoke all on public.attendance_records from anon, authenticated;
revoke all on public.whereabouts_entries from anon, authenticated;
revoke all on public.whereabouts_pings from anon, authenticated;
revoke all on public.parent_alerts from anon, authenticated;
