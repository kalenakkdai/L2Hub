-- Class Officers fundraiser + homecoming, one row per cohort.
-- FastAPI service role only; no browser policies.

create table if not exists public.class_officer_workspaces (
    cohort text primary key check (cohort in ('senior', 'junior')),
    fundraiser_json text not null,
    homecoming_json text not null,
    updated_at timestamptz not null default now()
);

alter table public.class_officer_workspaces enable row level security;
