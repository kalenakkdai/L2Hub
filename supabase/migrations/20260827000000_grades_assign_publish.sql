-- Gradebook workflow permissions: heads grade, Jan assigns and publishes.
--
-- grades.assign          — create / configure assignments (Jan)
-- grades.grade_committee — enter scores for a led committee (heads)
-- grades.publish         — release scores so students can see them (Jan)
--
-- Legacy grades.edit remains in the catalog but no longer grants score entry.

insert into public.permissions (key, description, category)
values
    (
        'grades.assign',
        'Create and configure gradebook assignments',
        'grades'
    ),
    (
        'grades.grade_committee',
        'Enter grades for own committee',
        'grades'
    ),
    (
        'grades.publish',
        'Publish grades so students can see them',
        'grades'
    )
on conflict (key) do update
set
    description = excluded.description,
    category = excluded.category;

-- Committee heads: view + enter scores for their crew.
insert into public.role_permissions (role_id, permission_id, effect)
select r.id, p.id, 'allow'
from public.roles r
cross join public.permissions p
where r.slug = 'committee_head'
  and p.key in ('grades.view_committee', 'grades.grade_committee')
on conflict do nothing;
