-- Class Officers platform roles and permissions.
--
-- Class Advisors (two per class) may only view Class Officers progress.
-- Class Officers (SCO/JCO) may view and edit fundraiser + homecoming plans.
-- ASBO / AC / President pick up both keys through their existing bundles.

insert into public.roles (name, slug, rank, is_system, is_assignable)
values
    ('Class Advisor', 'class_advisor', 20, true, true),
    ('Class Officer', 'class_officer', 25, true, true)
on conflict (slug) do update
set
    name = excluded.name,
    rank = excluded.rank,
    is_system = true,
    is_assignable = excluded.is_assignable;

insert into public.permissions (key, description, category)
values
    (
        'class_officers.view',
        'View the Class Officers platform',
        'class_officers'
    ),
    (
        'class_officers.manage',
        'Edit Class Officers fundraiser and homecoming plans',
        'class_officers'
    )
on conflict (key) do update
set
    description = excluded.description,
    category = excluded.category;

-- Class Advisor: view + notifications only.
insert into public.role_permissions (role_id, permission_id, effect)
select r.id, p.id, 'allow'
from public.roles r
cross join public.permissions p
where r.slug = 'class_advisor'
  and p.key in ('class_officers.view', 'notifications.view_own')
on conflict (role_id, permission_id) do nothing;

-- Class Officer: member baseline is assigned separately via Member role;
-- attach the Class Officers keys onto this role.
insert into public.role_permissions (role_id, permission_id, effect)
select r.id, p.id, 'allow'
from public.roles r
cross join public.permissions p
where r.slug = 'class_officer'
  and p.key in ('class_officers.view', 'class_officers.manage')
on conflict (role_id, permission_id) do nothing;

-- ASBO / AC / President already receive catalog-wide grants in app seed;
-- ensure the new keys are linked for DB-backed RLS consumers too.
insert into public.role_permissions (role_id, permission_id, effect)
select r.id, p.id, 'allow'
from public.roles r
cross join public.permissions p
where r.slug in ('asbo', 'ac', 'president')
  and p.key in ('class_officers.view', 'class_officers.manage')
on conflict (role_id, permission_id) do nothing;
