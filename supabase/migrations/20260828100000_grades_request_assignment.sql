-- Gradebook: heads request draft assignments; Jan/Jadon grade and approve.
--
-- grades.request_assignment — committee heads send draft assignment requests
--                             to Jan (and Jadon) for approval.
--
-- grades.grade_committee description updated: heads enter class-wide scores
-- in the separate "Committee grades" category (not individual assignments).

insert into public.permissions (key, description, category)
values
    (
        'grades.request_assignment',
        'Send draft assignment requests to Jan for approval',
        'grades'
    )
on conflict (key) do update
set
    description = excluded.description,
    category = excluded.category;

update public.permissions
set description = 'Enter committee-category grades for the class (heads: own committee)'
where key = 'grades.grade_committee';

-- Committee heads: draft requests + committee-category grades.
insert into public.role_permissions (role_id, permission_id, effect)
select r.id, p.id, 'allow'
from public.roles r
cross join public.permissions p
where r.slug = 'committee_head'
  and p.key in (
      'grades.view_committee',
      'grades.grade_committee',
      'grades.request_assignment'
  )
on conflict do nothing;

-- Preference rows for Jan↔Jadon transparency and head→Jan requests.
alter table public.notification_preferences
    drop constraint if exists notification_preferences_event_type_check;

alter table public.notification_preferences
    add constraint notification_preferences_event_type_check
    check (event_type in (
        'task_assigned',
        'task_due_soon',
        'task_overdue',
        'event_created',
        'event_starting',
        'crew_announcement',
        'points_awarded',
        'level_up',
        'wrapped_activity',
        'committee_request',
        'whereabouts_ping',
        'gradebook_activity',
        'gradebook_requests'
    ));
