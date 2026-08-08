-- Development seed users for the Class Officers platform (local Supabase Auth).
--
-- Password for every account below: l2hubdev
-- Emails use the non-routable @l2hub.local domain — never production addresses.
--
-- Depends on:
--   20260807040000_seed_development_users.sql (auth seed pattern, pgcrypto)
--   20260808010000_class_officers_roles.sql   (class_officer / class_advisor roles)
--
-- Idempotent: safe to re-run. Auth rows use fixed UUIDs matching backend seed.py.
--
-- Note: handle_new_user() auto-assigns the Member baseline on profile creation.
-- Class Officers keep it; Class Advisors are view-only, so their Member row is
-- removed below to match backend/app/db/seed.py.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Auth users + identities (required for email/password sign-in)
-- ---------------------------------------------------------------------------

with seed_users (
    id,
    email,
    full_name
) as (
    values
        (
            'a1111111-a111-4111-8111-111111111111'::uuid,
            'senior.advisor1@l2hub.local',
            'Pat Rivera'
        ),
        (
            'a2222222-a222-4222-8222-222222222222'::uuid,
            'senior.advisor2@l2hub.local',
            'Casey Ng'
        ),
        (
            'a3333333-a333-4333-8333-333333333333'::uuid,
            'junior.advisor1@l2hub.local',
            'Morgan Ellis'
        ),
        (
            'a4444444-a444-4444-8444-444444444444'::uuid,
            'junior.advisor2@l2hub.local',
            'Jamie Soto'
        ),
        (
            'b1111111-b111-4111-8111-111111111111'::uuid,
            'sco@l2hub.local',
            'Alex Kim'
        ),
        (
            'b2222222-b222-4222-8222-222222222222'::uuid,
            'jco@l2hub.local',
            'Jamie Park'
        )
)
insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
)
select
    '00000000-0000-0000-0000-000000000000',
    s.id,
    'authenticated',
    'authenticated',
    s.email,
    extensions.crypt('l2hubdev', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', s.full_name),
    now(),
    now(),
    '',
    '',
    '',
    ''
from seed_users s
where not exists (
    select 1 from auth.users existing where existing.id = s.id
)
and not exists (
    select 1 from auth.users existing where existing.email = s.email
);

with seed_users (
    id,
    email
) as (
    values
        ('a1111111-a111-4111-8111-111111111111'::uuid, 'senior.advisor1@l2hub.local'),
        ('a2222222-a222-4222-8222-222222222222'::uuid, 'senior.advisor2@l2hub.local'),
        ('a3333333-a333-4333-8333-333333333333'::uuid, 'junior.advisor1@l2hub.local'),
        ('a4444444-a444-4444-8444-444444444444'::uuid, 'junior.advisor2@l2hub.local'),
        ('b1111111-b111-4111-8111-111111111111'::uuid, 'sco@l2hub.local'),
        ('b2222222-b222-4222-8222-222222222222'::uuid, 'jco@l2hub.local')
)
insert into auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
)
select
    s.id,
    s.id,
    jsonb_build_object(
        'sub', s.id::text,
        'email', s.email,
        'email_verified', true,
        'phone_verified', false
    ),
    'email',
    s.id::text,
    now(),
    now(),
    now()
from seed_users s
join auth.users u on u.id = s.id
where not exists (
    select 1
    from auth.identities i
    where i.user_id = s.id
      and i.provider = 'email'
);

-- Signup trigger creates profiles + Member. Refresh display names for clarity.
update public.profiles p
set
    full_name = v.full_name,
    email = v.email,
    status = 'active',
    updated_at = now()
from (
    values
        ('a1111111-a111-4111-8111-111111111111'::uuid, 'senior.advisor1@l2hub.local', 'Pat Rivera'),
        ('a2222222-a222-4222-8222-222222222222'::uuid, 'senior.advisor2@l2hub.local', 'Casey Ng'),
        ('a3333333-a333-4333-8333-333333333333'::uuid, 'junior.advisor1@l2hub.local', 'Morgan Ellis'),
        ('a4444444-a444-4444-8444-444444444444'::uuid, 'junior.advisor2@l2hub.local', 'Jamie Soto'),
        ('b1111111-b111-4111-8111-111111111111'::uuid, 'sco@l2hub.local', 'Alex Kim'),
        ('b2222222-b222-4222-8222-222222222222'::uuid, 'jco@l2hub.local', 'Jamie Park')
) as v(id, email, full_name)
where p.id = v.id;

-- ---------------------------------------------------------------------------
-- Role assignments (global scope)
-- ---------------------------------------------------------------------------

-- Class Officers: keep the Member baseline and add class_officer.
insert into public.user_roles (user_id, role_id)
select u.id, r.id
from (
    values
        ('b1111111-b111-4111-8111-111111111111'::uuid, 'class_officer'),
        ('b2222222-b222-4222-8222-222222222222'::uuid, 'class_officer')
) as u(id, role_slug)
join public.roles r on r.slug = u.role_slug
where exists (select 1 from public.profiles p where p.id = u.id)
  and not exists (
      select 1
      from public.user_roles ur
      where ur.user_id = u.id
        and ur.role_id = r.id
        and ur.committee_id is null
        and ur.event_id is null
  );

-- Class Advisors: view-only. Assign class_advisor, then strip the Member
-- baseline the signup trigger added so their only power is watching progress.
insert into public.user_roles (user_id, role_id)
select u.id, r.id
from (
    values
        ('a1111111-a111-4111-8111-111111111111'::uuid, 'class_advisor'),
        ('a2222222-a222-4222-8222-222222222222'::uuid, 'class_advisor'),
        ('a3333333-a333-4333-8333-333333333333'::uuid, 'class_advisor'),
        ('a4444444-a444-4444-8444-444444444444'::uuid, 'class_advisor')
) as u(id, role_slug)
join public.roles r on r.slug = u.role_slug
where exists (select 1 from public.profiles p where p.id = u.id)
  and not exists (
      select 1
      from public.user_roles ur
      where ur.user_id = u.id
        and ur.role_id = r.id
        and ur.committee_id is null
        and ur.event_id is null
  );

delete from public.user_roles ur
using public.roles r
where ur.role_id = r.id
  and r.slug = 'member'
  and ur.user_id in (
      'a1111111-a111-4111-8111-111111111111'::uuid,
      'a2222222-a222-4222-8222-222222222222'::uuid,
      'a3333333-a333-4333-8333-333333333333'::uuid,
      'a4444444-a444-4444-8444-444444444444'::uuid
  );
