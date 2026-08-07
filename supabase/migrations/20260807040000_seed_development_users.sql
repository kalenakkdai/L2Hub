-- Development seed users for local Supabase Auth login.
--
-- Password for every account below: l2hubdev
-- Emails use the non-routable @l2hub.local domain — never production addresses.
--
-- Depends on:
--   20260807020000_normalize_auth_and_rls.sql  (roles, signup trigger)
--   20260807030000_seed_default_committees.sql (community committee)
--
-- Idempotent: safe to re-run. Auth rows use fixed UUIDs matching backend seed.py.

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
            'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
            'ac@l2hub.local',
            'Elena Vargas'
        ),
        (
            '99999999-9999-4999-8999-999999999999'::uuid,
            'president@l2hub.local',
            'Brittany Lu'
        ),
        (
            'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
            'asbo@l2hub.local',
            'Taylor Kim'
        ),
        (
            'cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid,
            'community.head@l2hub.local',
            'Jordan Lee'
        ),
        (
            'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'::uuid,
            'community.member@l2hub.local',
            'Avery Chen'
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
        (
            'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
            'ac@l2hub.local'
        ),
        (
            '99999999-9999-4999-8999-999999999999'::uuid,
            'president@l2hub.local'
        ),
        (
            'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
            'asbo@l2hub.local'
        ),
        (
            'cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid,
            'community.head@l2hub.local'
        ),
        (
            'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'::uuid,
            'community.member@l2hub.local'
        )
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
        (
            'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
            'ac@l2hub.local',
            'Elena Vargas'
        ),
        (
            '99999999-9999-4999-8999-999999999999'::uuid,
            'president@l2hub.local',
            'Brittany Lu'
        ),
        (
            'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
            'asbo@l2hub.local',
            'Taylor Kim'
        ),
        (
            'cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid,
            'community.head@l2hub.local',
            'Jordan Lee'
        ),
        (
            'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'::uuid,
            'community.member@l2hub.local',
            'Avery Chen'
        )
) as v(id, email, full_name)
where p.id = v.id;

-- ---------------------------------------------------------------------------
-- Elevated roles (Member already assigned by handle_new_user)
-- ---------------------------------------------------------------------------

insert into public.user_roles (user_id, role_id)
select u.id, r.id
from (
    values
        ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid, 'ac'),
        ('99999999-9999-4999-8999-999999999999'::uuid, 'president'),
        ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid, 'asbo')
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

-- Committee Head scoped to Community
insert into public.user_roles (user_id, role_id, committee_id)
select
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid,
    r.id,
    c.id
from public.roles r
cross join public.committees c
where r.slug = 'committee_head'
  and c.slug = 'community'
  and exists (
      select 1
      from public.profiles p
      where p.id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid
  )
  and not exists (
      select 1
      from public.user_roles ur
      where ur.user_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid
        and ur.role_id = r.id
        and ur.committee_id = c.id
        and ur.event_id is null
  );

-- ---------------------------------------------------------------------------
-- Committee memberships
-- ---------------------------------------------------------------------------

insert into public.committee_memberships (
    user_id,
    committee_id,
    membership_type,
    is_head
)
select
    m.user_id,
    c.id,
    m.membership_type,
    m.is_head
from (
    values
        -- AC observes Community operations
        (
            'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
            'community',
            'member',
            false
        ),
        -- President sits with Community (Maze Day managing committee)
        (
            '99999999-9999-4999-8999-999999999999'::uuid,
            'community',
            'member',
            false
        ),
        -- ASBO also on Activities for ops breadth
        (
            'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
            'activities',
            'member',
            false
        ),
        (
            'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
            'community',
            'member',
            false
        ),
        -- Committee Head leads Community
        (
            'cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid,
            'community',
            'head',
            true
        ),
        -- Member of Community
        (
            'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'::uuid,
            'community',
            'member',
            false
        )
) as m(user_id, committee_slug, membership_type, is_head)
join public.committees c on c.slug = m.committee_slug
where exists (select 1 from public.profiles p where p.id = m.user_id)
on conflict (user_id, committee_id) do update
set
    membership_type = excluded.membership_type,
    is_head = excluded.is_head;
