-- The L2 Board and the cross-committee request log.
--
-- Two tables behind the two Leadership tabs that replaced Tools and Resources.
-- `tasks` is what each committee is working on; `committee_requests` is one
-- committee asking another for something, with the answer recorded next to it.
--
-- A request may point back at the task it came from: listing a task on the
-- board can fan out to "we also need Publicity", and source_task_id is what
-- makes that trail readable later.

create table if not exists public.tasks (
    id                  uuid primary key default gen_random_uuid(),
    committee_id        uuid not null references public.committees(id) on delete cascade,
    title               text not null,
    details             text not null default '',
    status              text not null default 'todo'
                        check (status in ('todo', 'doing', 'done')),
    assignee_user_id    uuid references public.profiles(id) on delete set null,
    due_on              date,
    created_by_user_id  uuid references public.profiles(id) on delete set null,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);

create index if not exists tasks_committee_idx
    on public.tasks (committee_id, status);
create index if not exists tasks_assignee_idx
    on public.tasks (assignee_user_id)
    where assignee_user_id is not null;

create table if not exists public.committee_requests (
    id                       uuid primary key default gen_random_uuid(),
    requesting_committee_id  uuid not null references public.committees(id) on delete cascade,
    target_committee_id      uuid not null references public.committees(id) on delete cascade,
    title                    text not null,
    details                  text not null default '',
    status                   text not null default 'open'
                             check (status in ('open', 'accepted', 'done', 'declined')),
    due_on                   date,
    -- Kept when the originating task is deleted: the request stands on its own
    -- once the other committee has been asked.
    source_task_id           uuid references public.tasks(id) on delete set null,
    created_by_user_id       uuid references public.profiles(id) on delete set null,
    responded_by_user_id     uuid references public.profiles(id) on delete set null,
    responded_at             timestamptz,
    created_at               timestamptz not null default now(),
    updated_at               timestamptz not null default now(),
    -- Asking yourself for help is just the task.
    constraint committee_requests_distinct_committees
        check (requesting_committee_id <> target_committee_id)
);

create index if not exists committee_requests_target_idx
    on public.committee_requests (target_committee_id, status);
create index if not exists committee_requests_requester_idx
    on public.committee_requests (requesting_committee_id, status);

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------

insert into public.permissions (key, description, category)
values
    ('requests.view_own_committee', 'View own committee''s requests', 'requests'),
    ('requests.create', 'File a request to another committee', 'requests'),
    (
        'requests.manage_own_committee',
        'Accept or complete requests sent to own committee',
        'requests'
    ),
    ('requests.view_all', 'View every committee''s requests', 'requests'),
    (
        'requests.manage_all',
        'File and answer requests for any committee',
        'requests'
    )
on conflict (key) do update
set
    description = excluded.description,
    category = excluded.category;

-- Members work requests from the dashboard widget, scoped to their own
-- committee. They do not receive requests.view_all, which is what gates the
-- cross-org /requests page.
insert into public.role_permissions (role_id, permission_id, effect)
select r.id, p.id, 'allow'
from public.roles r
cross join public.permissions p
where r.slug = 'member'
  and p.key in (
      'requests.view_own_committee',
      'requests.create',
      'requests.manage_own_committee'
  )
on conflict (role_id, permission_id) do nothing;

-- Class Officers and Committee Heads are the officer tier: they get the board
-- and the cross-org log on top of the member baseline. Read-only across other
-- committees — requests.manage_all is deliberately not in this list, so a head
-- cannot answer a request that was sent to somebody else.
insert into public.role_permissions (role_id, permission_id, effect)
select r.id, p.id, 'allow'
from public.roles r
cross join public.permissions p
where r.slug in ('class_officer', 'committee_head')
  and p.key in (
      'requests.view_own_committee',
      'requests.create',
      'requests.manage_own_committee',
      'requests.view_all',
      'tasks.view_all'
  )
on conflict (role_id, permission_id) do nothing;

-- ASBO / AC / President hold the whole catalog through the app seed; link the
-- new keys explicitly so DB-backed RLS sees them too.
insert into public.role_permissions (role_id, permission_id, effect)
select r.id, p.id, 'allow'
from public.roles r
cross join public.permissions p
where r.slug in ('asbo', 'ac', 'president')
  and p.key in (
      'requests.view_own_committee',
      'requests.create',
      'requests.manage_own_committee',
      'requests.view_all',
      'requests.manage_all'
  )
on conflict (role_id, permission_id) do nothing;

-- ---------------------------------------------------------------------------
-- Notification preference for the request lifecycle
-- ---------------------------------------------------------------------------

-- All four request notices — received, accepted, declined, completed — share
-- one switch: someone who wants to know they were asked also wants the answer.
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
        'committee_request'
    ));

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.tasks enable row level security;
alter table public.committee_requests enable row level security;

-- Policies decide which rows; these decide whether the table can be touched at
-- all. Without them every policy below is unreachable, because the privilege
-- check fails first.
--
-- No delete on committee_requests: a request is the paper trail. Declining one
-- is an answer that stays on the record, and there is nothing this product
-- needs that removing the row would provide.
grant select, insert, update, delete on public.tasks to authenticated;
grant select, insert, update on public.committee_requests to authenticated;

-- Tasks are readable by anyone who can see the whole board, and by members of
-- the owning committee. Writes need the committee-scoped manage key, which
-- current_user_has_permission resolves against the caller's role assignments.
create policy tasks_select_authorized
    on public.tasks for select to authenticated
    using (
        public.current_user_has_permission('tasks.view_all')
        or exists (
            select 1 from public.committee_memberships m
            where m.user_id = (select auth.uid())
              and m.committee_id = tasks.committee_id
        )
    );

create policy tasks_write_authorized
    on public.tasks for all to authenticated
    using (
        public.current_user_has_permission('tasks.manage_all')
        or public.current_user_has_permission(
            'tasks.manage_committee', tasks.committee_id
        )
    )
    with check (
        public.current_user_has_permission('tasks.manage_all')
        or public.current_user_has_permission(
            'tasks.manage_committee', tasks.committee_id
        )
    );

-- A request is visible to both sides of it, and to leadership holding the
-- org-wide view. Being asked and having asked are equally good reasons to read
-- the row.
create policy committee_requests_select_authorized
    on public.committee_requests for select to authenticated
    using (
        public.current_user_has_permission('requests.view_all')
        or exists (
            select 1 from public.committee_memberships m
            where m.user_id = (select auth.uid())
              and m.committee_id in (
                  committee_requests.requesting_committee_id,
                  committee_requests.target_committee_id
              )
        )
    );

create policy committee_requests_insert_authorized
    on public.committee_requests for insert to authenticated
    with check (
        public.current_user_has_permission('requests.manage_all')
        or (
            public.current_user_has_permission('requests.create')
            and exists (
                select 1 from public.committee_memberships m
                where m.user_id = (select auth.uid())
                  and m.committee_id = committee_requests.requesting_committee_id
            )
        )
    );

-- Only the committee that was asked answers. The requester can read and chase
-- the row, but marking someone else's work done is not theirs to do.
create policy committee_requests_update_authorized
    on public.committee_requests for update to authenticated
    using (
        public.current_user_has_permission('requests.manage_all')
        or exists (
            select 1 from public.committee_memberships m
            where m.user_id = (select auth.uid())
              and m.committee_id = committee_requests.target_committee_id
        )
    )
    with check (
        public.current_user_has_permission('requests.manage_all')
        or exists (
            select 1 from public.committee_memberships m
            where m.user_id = (select auth.uid())
              and m.committee_id = committee_requests.target_committee_id
        )
    );

comment on table public.committee_requests is
    'One committee asking another for work, with the answer recorded. '
    'source_task_id is set when the request was fanned out from an L2 Board task.';
