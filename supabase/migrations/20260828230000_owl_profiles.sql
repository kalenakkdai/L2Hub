-- A+-gated campsite owl cosmetics and reward points.

create table if not exists public.owl_profiles (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  points integer not null default 0,
  belly_color text not null default 'snow',
  wing_color text not null default 'mist',
  accessory text not null default 'none',
  trail text not null default 'none',
  unlocked_json text not null default '[]',
  weighted_percent double precision,
  access_active boolean not null default false,
  access_revoked_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.owl_profiles enable row level security;
-- FastAPI service role only; no browser policies.
