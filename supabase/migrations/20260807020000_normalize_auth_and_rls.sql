-- Normalize authentication around Supabase Auth + role assignments.
--
-- This migration intentionally runs after the existing profile, RBAC, and
-- Event Summary migrations. It:
--   1. seeds the five protected roles and the canonical permission catalog,
--   2. backfills normalized user_roles without trusting auth metadata,
--   3. replaces profiles.role / public.user_role with role assignments,
--   4. replaces the signup trigger so every auth user receives Member,
--   5. enables RLS on every application table and installs scoped policies.

-- ---------------------------------------------------------------------------
-- Canonical role hierarchy
-- ---------------------------------------------------------------------------

insert into public.roles (name, slug, rank, is_system, is_assignable)
values
    ('AC', 'ac', 100, true, false),
    ('President', 'president', 100, true, false),
    ('ASBO', 'asbo', 80, true, true),
    ('Committee Head', 'committee_head', 50, true, true),
    ('Member', 'member', 10, true, true)
on conflict (slug) do update
set
    name = excluded.name,
    rank = excluded.rank,
    is_system = true,
    is_assignable = excluded.is_assignable;

-- Canonical permissions. API routes and RLS helpers use these exact keys.
insert into public.permissions (key, description, category)
values
    ('users.view', 'View user roster', 'users'),
    ('users.manage', 'Create, invite, deactivate users', 'users'),
    ('roles.view', 'View roles and assignments', 'roles'),
    ('roles.manage', 'Edit role definitions', 'roles'),
    ('roles.assign', 'Assign or remove roles', 'roles'),
    ('committees.view', 'View committees', 'committees'),
    ('committees.manage', 'Manage committees', 'committees'),
    ('committees.view_members', 'View committee members', 'committees'),
    ('committees.manage_members', 'Manage committee membership', 'committees'),
    ('events.view', 'View events', 'events'),
    ('events.create', 'Create events', 'events'),
    ('events.edit', 'Edit events', 'events'),
    ('events.delete', 'Delete events', 'events'),
    ('tasks.view_own', 'View own tasks', 'tasks'),
    ('tasks.view_committee', 'View committee tasks', 'tasks'),
    ('tasks.manage_committee', 'Manage committee tasks', 'tasks'),
    ('tasks.view_all', 'View all tasks', 'tasks'),
    ('tasks.manage_all', 'Manage all tasks', 'tasks'),
    ('debrief.submit', 'Submit own debrief', 'debrief'),
    ('debrief.view_own', 'View own debrief submissions', 'debrief'),
    ('debrief.view_committee', 'View committee debriefs', 'debrief'),
    ('debrief.view_all', 'View all debriefs', 'debrief'),
    ('debrief.start', 'Start debrief sessions', 'debrief'),
    ('debrief.end', 'End debrief sessions', 'debrief'),
    ('debrief.reopen', 'Reopen debrief sessions', 'debrief'),
    ('attendance.view_committee', 'View committee attendance', 'attendance'),
    ('attendance.manage_committee', 'Manage committee attendance', 'attendance'),
    ('attendance.view_all', 'View all attendance', 'attendance'),
    ('attendance.manage_all', 'Manage all attendance', 'attendance'),
    ('grades.view_own', 'View own grades', 'grades'),
    ('grades.view_committee', 'View committee grades', 'grades'),
    ('grades.view_all', 'View all grades', 'grades'),
    ('grades.edit', 'Edit grades', 'grades'),
    ('agenda.view_committee', 'View committee agendas', 'agenda'),
    ('agenda.edit_committee', 'Edit committee agendas', 'agenda'),
    ('agenda.view_all', 'View all agendas', 'agenda'),
    ('agenda.edit_all', 'Edit all agendas', 'agenda'),
    ('agenda.finalize', 'Finalize agendas', 'agenda'),
    ('agenda.generate', 'Generate leadership agendas from Wrapped', 'agenda'),
    ('wrapped.view_committee', 'View committee Wrapped reports', 'wrapped'),
    ('wrapped.view_all', 'View all Wrapped reports', 'wrapped'),
    ('wrapped.view_published', 'View published Event Wrapped reports', 'wrapped'),
    ('wrapped.request', 'Request Event Summary generation', 'wrapped'),
    ('wrapped.approve', 'Approve or reject Event Summary requests', 'wrapped'),
    ('wrapped.generate', 'Activate or regenerate Event Summaries', 'wrapped'),
    ('wrapped.edit', 'Edit Event Summary content', 'wrapped'),
    ('wrapped.publish', 'Publish Wrapped reports', 'wrapped'),
    ('notifications.view_own', 'View own notifications', 'notifications'),
    ('materials.view_committee', 'View committee materials', 'materials'),
    ('materials.manage_committee', 'Manage committee materials', 'materials'),
    ('materials.view_all', 'View all materials', 'materials'),
    ('materials.manage_all', 'Manage all materials', 'materials'),
    ('feedback.view_private', 'View private feedback', 'feedback'),
    ('feedback.view_anonymous', 'View anonymous feedback', 'feedback'),
    ('feedback.manage', 'Manage feedback workflows', 'feedback'),
    ('knowledge.view', 'View knowledge documents', 'knowledge'),
    ('knowledge.upload', 'Upload knowledge documents', 'knowledge'),
    ('knowledge.manage', 'Manage knowledge documents', 'knowledge'),
    ('admin.settings', 'Configure platform settings', 'admin'),
    ('admin.audit', 'View audit logs', 'admin'),
    ('admin.preview_user', 'Preview another user dashboard', 'admin')
on conflict (key) do update
set
    description = excluded.description,
    category = excluded.category;

-- System permission bundles are migration-owned. Rebuild them deterministically.
delete from public.role_permissions
where role_id in (
    select id from public.roles
    where slug in ('ac', 'president', 'asbo', 'committee_head', 'member')
);

-- AC and President are peer super-admin roles.
insert into public.role_permissions (role_id, permission_id, effect)
select r.id, p.id, 'allow'
from public.roles r
cross join public.permissions p
where r.slug in ('ac', 'president');

-- Member baseline.
insert into public.role_permissions (role_id, permission_id, effect)
select r.id, p.id, 'allow'
from public.roles r
join public.permissions p on p.key in (
    'tasks.view_own',
    'events.view',
    'debrief.submit',
    'debrief.view_own',
    'grades.view_own',
    'committees.view',
    'wrapped.view_published',
    'notifications.view_own'
)
where r.slug = 'member';

-- Committee Head includes Member plus committee-scoped operations.
insert into public.role_permissions (role_id, permission_id, effect)
select r.id, p.id, 'allow'
from public.roles r
join public.permissions p on p.key in (
    'tasks.view_own',
    'events.view',
    'debrief.submit',
    'debrief.view_own',
    'grades.view_own',
    'committees.view',
    'wrapped.view_published',
    'notifications.view_own',
    'committees.view_members',
    'tasks.view_committee',
    'tasks.manage_committee',
    'debrief.view_committee',
    'attendance.view_committee',
    'attendance.manage_committee',
    'agenda.view_committee',
    'agenda.edit_committee',
    'wrapped.view_committee',
    'wrapped.request',
    'materials.view_committee',
    'materials.manage_committee'
)
where r.slug = 'committee_head';

-- ASBO has platform operations but no user/role administration, grade edits,
-- private feedback, settings, or Wrapped approval/publication.
insert into public.role_permissions (role_id, permission_id, effect)
select r.id, p.id, 'allow'
from public.roles r
cross join public.permissions p
where r.slug = 'asbo'
  and p.key not in (
      'users.view',
      'users.manage',
      'roles.manage',
      'roles.assign',
      'grades.edit',
      'feedback.view_private',
      'feedback.view_anonymous',
      'feedback.manage',
      'admin.settings',
      'admin.audit',
      'admin.preview_user',
      'wrapped.approve',
      'wrapped.generate',
      'wrapped.edit',
      'wrapped.publish',
      'agenda.generate',
      'agenda.finalize',
      'agenda.edit_all'
  );

-- ---------------------------------------------------------------------------
-- Preserve existing users and normalize role assignments
-- ---------------------------------------------------------------------------

-- Every existing profile receives the Member baseline.
insert into public.user_roles (user_id, role_id)
select p.id, r.id
from public.profiles p
cross join public.roles r
where r.slug = 'member'
  and not exists (
      select 1
      from public.user_roles ur
      where ur.user_id = p.id
        and ur.role_id = r.id
        and ur.committee_id is null
        and ur.event_id is null
  );

-- Preserve legacy elevated profile roles as normalized global assignments.
-- Committee Head is handled separately from committee membership so it never
-- accidentally becomes a global role.
insert into public.user_roles (user_id, role_id)
select
    p.id,
    r.id
from public.profiles p
join public.roles r
  on r.slug = case p.role::text
      when 'adviser' then 'ac'
      when 'ac' then 'ac'
      when 'officer' then 'asbo'
      when 'asbo' then 'asbo'
      else null
  end
where not exists (
    select 1
    from public.user_roles ur
    where ur.user_id = p.id
      and ur.role_id = r.id
      and ur.committee_id is null
      and ur.event_id is null
);

-- Committee Head is always scoped to a committee the user actually heads.
insert into public.user_roles (user_id, role_id, committee_id)
select cm.user_id, r.id, cm.committee_id
from public.committee_memberships cm
cross join public.roles r
where cm.is_head
  and r.slug = 'committee_head'
  and not exists (
      select 1
      from public.user_roles ur
      where ur.user_id = cm.user_id
        and ur.role_id = r.id
        and ur.committee_id = cm.committee_id
  );

-- Replace any legacy role-table assignments before removing legacy roles.
insert into public.user_roles (
    user_id, role_id, committee_id, event_id, starts_at, ends_at, created_at
)
select
    ur.user_id,
    canonical.id,
    ur.committee_id,
    ur.event_id,
    ur.starts_at,
    ur.ends_at,
    ur.created_at
from public.user_roles ur
join public.roles legacy on legacy.id = ur.role_id
join public.roles canonical on canonical.slug = case legacy.slug
    when 'student' then 'member'
    when 'officer' then 'asbo'
    when 'adviser' then 'ac'
end
where legacy.slug in ('student', 'officer', 'adviser')
  and not exists (
      select 1
      from public.user_roles existing
      where existing.user_id = ur.user_id
        and existing.role_id = canonical.id
        and existing.committee_id is not distinct from ur.committee_id
        and existing.event_id is not distinct from ur.event_id
  );

delete from public.user_roles
where role_id in (
    select id from public.roles where slug in ('student', 'officer', 'adviser')
);
delete from public.roles where slug in ('student', 'officer', 'adviser');

-- Do not silently reinterpret custom/unknown roles. An operator must map them
-- explicitly before retrying this migration.
do $$
begin
    if exists (
        select 1
        from public.roles
        where slug not in ('ac', 'president', 'asbo', 'committee_head', 'member')
    ) then
        raise exception
            'Unknown roles exist. Map them to the five canonical roles before migrating.';
    end if;
end;
$$;

-- Widened by 20260808005000 when the Class Officer roles arrived.
alter table public.roles
    drop constraint if exists roles_slug_canonical;
alter table public.roles
    add constraint roles_slug_canonical
    check (slug in ('ac', 'president', 'asbo', 'committee_head', 'member'));

-- PostgreSQL 15 supports NULLS NOT DISTINCT, preventing duplicate global,
-- committee, or event assignments despite nullable scope columns.
with duplicate_assignments as (
    select
        id,
        row_number() over (
            partition by user_id, role_id, committee_id, event_id
            order by created_at, id
        ) as occurrence
    from public.user_roles
)
delete from public.user_roles
where id in (
    select id from duplicate_assignments where occurrence > 1
);

create unique index if not exists user_roles_unique_scope_idx
    on public.user_roles (user_id, role_id, committee_id, event_id) nulls not distinct;

-- event_id was intentionally unbound in the earlier migration because events
-- did not exist yet. It can now be made a real foreign key.
alter table public.user_roles
    drop constraint if exists user_roles_event_id_fkey;
alter table public.user_roles
    add constraint user_roles_event_id_fkey
    foreign key (event_id) references public.events(id) on delete cascade;

-- ---------------------------------------------------------------------------
-- Replace the legacy profile enum and signup trigger
-- ---------------------------------------------------------------------------

drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists profiles_prevent_role_self_change on public.profiles;
drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_select_staff on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
drop function if exists public.handle_new_user();
drop function if exists public.prevent_role_self_change();
drop function if exists public.is_staff();
drop function if exists public.current_user_role();

alter table public.profiles drop column if exists role;
drop type if exists public.user_role;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    member_role_id uuid;
begin
    select id into member_role_id
    from public.roles
    where slug = 'member';

    if member_role_id is null then
        raise exception 'The protected Member role is missing';
    end if;

    insert into public.profiles (id, email, full_name, status)
    values (
        new.id,
        coalesce(new.email, ''),
        nullif(new.raw_user_meta_data ->> 'full_name', ''),
        'active'
    )
    on conflict (id) do update
    set email = excluded.email;

    insert into public.user_roles (user_id, role_id)
    values (new.id, member_role_id)
    on conflict do nothing;

    return new;
end;
$$;

comment on function public.handle_new_user() is
    'Creates public.profiles and assigns the protected Member role after auth signup.';

create trigger on_auth_user_created
    after insert on auth.users
    for each row
    execute function public.handle_new_user();

-- Backfill auth users that may have been created while the old trigger was absent.
insert into public.profiles (id, email, full_name, status)
select
    u.id,
    coalesce(u.email, ''),
    nullif(u.raw_user_meta_data ->> 'full_name', ''),
    'active'
from auth.users u
on conflict (id) do nothing;

insert into public.user_roles (user_id, role_id)
select p.id, r.id
from public.profiles p
cross join public.roles r
where r.slug = 'member'
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- RLS helper functions
-- ---------------------------------------------------------------------------

create or replace function public.current_user_has_role(role_slugs text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.user_roles ur
        join public.roles r on r.id = ur.role_id
        where ur.user_id = (select auth.uid())
          and r.slug = any(role_slugs)
          and ur.committee_id is null
          and ur.event_id is null
          and (ur.starts_at is null or ur.starts_at <= now())
          and (ur.ends_at is null or ur.ends_at > now())
    );
$$;

create or replace function public.current_user_rank()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
    select coalesce(max(r.rank), 0)
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = (select auth.uid())
      and (ur.starts_at is null or ur.starts_at <= now())
      and (ur.ends_at is null or ur.ends_at > now());
$$;

create or replace function public.current_user_has_permission(
    permission_key text,
    requested_committee_id uuid default null,
    requested_event_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select
        exists (
            select 1
            from public.user_roles ur
            join public.role_permissions rp on rp.role_id = ur.role_id
            join public.permissions p on p.id = rp.permission_id
            where ur.user_id = (select auth.uid())
              and p.key = permission_key
              and rp.effect = 'allow'
              and (ur.starts_at is null or ur.starts_at <= now())
              and (ur.ends_at is null or ur.ends_at > now())
              and (
                  (ur.committee_id is null and ur.event_id is null)
                  or ur.committee_id = requested_committee_id
                  or ur.event_id = requested_event_id
              )
        )
        and not exists (
            select 1
            from public.user_roles ur
            join public.role_permissions rp on rp.role_id = ur.role_id
            join public.permissions p on p.id = rp.permission_id
            where ur.user_id = (select auth.uid())
              and p.key = permission_key
              and rp.effect = 'deny'
              and (ur.starts_at is null or ur.starts_at <= now())
              and (ur.ends_at is null or ur.ends_at > now())
              and (
                  (ur.committee_id is null and ur.event_id is null)
                  or ur.committee_id = requested_committee_id
                  or ur.event_id = requested_event_id
              )
        );
$$;

create or replace function public.current_user_is_committee_member(target_committee_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.committee_memberships cm
        where cm.user_id = (select auth.uid())
          and cm.committee_id = target_committee_id
    );
$$;

create or replace function public.current_user_heads_committee(target_committee_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.committee_memberships cm
        where cm.user_id = (select auth.uid())
          and cm.committee_id = target_committee_id
          and cm.is_head
    );
$$;

create or replace function public.current_user_can_access_event(target_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select
        public.current_user_has_role(array['ac', 'president', 'asbo'])
        or exists (
            select 1
            from public.events e
            join public.committee_memberships cm
              on cm.committee_id = e.managing_committee_id
            where e.id = target_event_id
              and cm.user_id = (select auth.uid())
        )
        or exists (
            select 1
            from public.user_roles ur
            where ur.user_id = (select auth.uid())
              and ur.event_id = target_event_id
              and (ur.starts_at is null or ur.starts_at <= now())
              and (ur.ends_at is null or ur.ends_at > now())
        );
$$;

-- These helpers intentionally expose only booleans. Authenticated callers
-- cannot inspect other users' assignments through SECURITY DEFINER.
revoke all on function public.current_user_has_role(text[]) from public;
revoke all on function public.current_user_rank() from public;
revoke all on function public.current_user_has_permission(text, uuid, uuid) from public;
revoke all on function public.current_user_is_committee_member(uuid) from public;
revoke all on function public.current_user_heads_committee(uuid) from public;
revoke all on function public.current_user_can_access_event(uuid) from public;
grant execute on function public.current_user_has_role(text[]) to authenticated;
grant execute on function public.current_user_rank() to authenticated;
grant execute on function public.current_user_has_permission(text, uuid, uuid) to authenticated;
grant execute on function public.current_user_is_committee_member(uuid) to authenticated;
grant execute on function public.current_user_heads_committee(uuid) to authenticated;
grant execute on function public.current_user_can_access_event(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Integrity triggers for direct authenticated writes
-- ---------------------------------------------------------------------------

create or replace function public.protect_profile_managed_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
    if current_user in ('postgres', 'service_role', 'supabase_admin') then
        return new;
    end if;

    if new.id is distinct from old.id or new.email is distinct from old.email then
        raise exception 'Profile identity fields are managed by Supabase Auth'
            using errcode = 'insufficient_privilege';
    end if;

    if new.status is distinct from old.status
       and not public.current_user_has_permission('users.manage')
    then
        raise exception 'users.manage is required to change profile status'
            using errcode = 'insufficient_privilege';
    end if;

    return new;
end;
$$;

drop trigger if exists profiles_protect_managed_fields on public.profiles;
create trigger profiles_protect_managed_fields
    before update on public.profiles
    for each row
    execute function public.protect_profile_managed_fields();

create or replace function public.protect_role_assignment()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
    target_rank integer;
    target_role_id uuid;
begin
    if current_user in ('postgres', 'service_role', 'supabase_admin') then
        if tg_op = 'DELETE' then
            return old;
        end if;
        return new;
    end if;

    if not public.current_user_has_permission('roles.assign') then
        raise exception 'roles.assign is required'
            using errcode = 'insufficient_privilege';
    end if;

    if tg_op = 'DELETE' then
        target_role_id := old.role_id;
    else
        target_role_id := new.role_id;
    end if;

    select rank into target_rank
    from public.roles
    where id = target_role_id;

    if target_rank >= public.current_user_rank()
       and not public.current_user_has_role(array['ac', 'president'])
    then
        raise exception 'A role at or above the caller rank cannot be assigned'
            using errcode = 'insufficient_privilege';
    end if;

    if tg_op = 'DELETE' then
        return old;
    end if;
    return new;
end;
$$;

drop trigger if exists user_roles_protect_assignment on public.user_roles;
create trigger user_roles_protect_assignment
    before insert or update or delete on public.user_roles
    for each row
    execute function public.protect_role_assignment();

create or replace function public.protect_system_role()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
    if tg_op = 'DELETE' and old.is_system then
        raise exception 'Protected system roles cannot be deleted or structurally changed'
            using errcode = 'insufficient_privilege';
    end if;

    if tg_op = 'UPDATE'
       and old.is_system
       and (
           new.slug is distinct from old.slug
           or new.rank is distinct from old.rank
           or new.is_system is false
       )
    then
        raise exception 'Protected system roles cannot be deleted or structurally changed'
            using errcode = 'insufficient_privilege';
    end if;

    if tg_op = 'DELETE' then
        return old;
    end if;
    return new;
end;
$$;

drop trigger if exists roles_protect_system on public.roles;
create trigger roles_protect_system
    before update or delete on public.roles
    for each row
    execute function public.protect_system_role();

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles enable row level security;
alter table public.committees enable row level security;
alter table public.committee_memberships enable row level security;
alter table public.events enable row level security;
alter table public.permission_overrides enable row level security;
alter table public.audit_logs enable row level security;
alter table public.event_summaries enable row level security;
alter table public.event_summary_requests enable row level security;
alter table public.event_agendas enable row level security;
alter table public.notifications enable row level security;
alter table public.debrief_participants enable row level security;

-- Remove policies from the legacy profile design before replacing them.
drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_select_staff on public.profiles;
drop policy if exists profiles_update_own on public.profiles;

-- Profiles: self, user administrators, or committee heads viewing members of
-- a committee they head.
create policy profiles_select_authorized
    on public.profiles for select to authenticated
    using (
        id = (select auth.uid())
        or public.current_user_has_permission('users.view')
        or exists (
            select 1
            from public.committee_memberships mine
            join public.committee_memberships theirs
              on theirs.committee_id = mine.committee_id
            where mine.user_id = (select auth.uid())
              and mine.is_head
              and theirs.user_id = profiles.id
        )
    );

create policy profiles_update_authorized
    on public.profiles for update to authenticated
    using (
        id = (select auth.uid())
        or public.current_user_has_permission('users.manage')
    )
    with check (
        id = (select auth.uid())
        or public.current_user_has_permission('users.manage')
    );

-- The role and permission catalogs are readable metadata. They are migration-
-- owned; authenticated users do not receive direct write grants.
create policy roles_select_authenticated
    on public.roles for select to authenticated using (true);
create policy permissions_select_authenticated
    on public.permissions for select to authenticated using (true);
create policy role_permissions_select_authenticated
    on public.role_permissions for select to authenticated using (true);

-- Role assignments: users can inspect their own; role administrators can
-- inspect and mutate all. The assignment trigger applies hierarchy checks.
create policy user_roles_select_authorized
    on public.user_roles for select to authenticated
    using (
        user_id = (select auth.uid())
        or public.current_user_has_permission('roles.view')
        or public.current_user_has_permission('users.view')
    );
create policy user_roles_insert_authorized
    on public.user_roles for insert to authenticated
    with check (public.current_user_has_permission('roles.assign'));
create policy user_roles_update_authorized
    on public.user_roles for update to authenticated
    using (public.current_user_has_permission('roles.assign'))
    with check (public.current_user_has_permission('roles.assign'));
create policy user_roles_delete_authorized
    on public.user_roles for delete to authenticated
    using (public.current_user_has_permission('roles.assign'));

-- Committees are visible to members and platform operations. Committee heads
-- can see and manage membership only in committees they head.
create policy committees_select_authorized
    on public.committees for select to authenticated
    using (
        public.current_user_has_role(array['ac', 'president', 'asbo'])
        or public.current_user_is_committee_member(id)
    );
create policy committees_insert_authorized
    on public.committees for insert to authenticated
    with check (public.current_user_has_permission('committees.manage'));
create policy committees_update_authorized
    on public.committees for update to authenticated
    using (public.current_user_has_permission('committees.manage'))
    with check (public.current_user_has_permission('committees.manage'));
create policy committees_delete_authorized
    on public.committees for delete to authenticated
    using (public.current_user_has_permission('committees.manage'));

create policy committee_memberships_select_authorized
    on public.committee_memberships for select to authenticated
    using (
        user_id = (select auth.uid())
        or public.current_user_has_permission('users.view')
        or public.current_user_heads_committee(committee_id)
    );
create policy committee_memberships_insert_authorized
    on public.committee_memberships for insert to authenticated
    with check (
        public.current_user_has_permission('committees.manage')
        or (
            public.current_user_heads_committee(committee_id)
            and public.current_user_has_permission(
                'committees.manage_members',
                committee_id
            )
        )
    );
create policy committee_memberships_update_authorized
    on public.committee_memberships for update to authenticated
    using (
        public.current_user_has_permission('committees.manage')
        or public.current_user_heads_committee(committee_id)
    )
    with check (
        public.current_user_has_permission('committees.manage')
        or public.current_user_heads_committee(committee_id)
    );
create policy committee_memberships_delete_authorized
    on public.committee_memberships for delete to authenticated
    using (
        public.current_user_has_permission('committees.manage')
        or public.current_user_heads_committee(committee_id)
    );

-- Events are visible to platform operations, members of the managing
-- committee, and explicit event-role assignees.
create policy events_select_authorized
    on public.events for select to authenticated
    using (
        public.current_user_has_permission(
            'events.view',
            managing_committee_id,
            id
        )
        and public.current_user_can_access_event(id)
    );
create policy events_insert_authorized
    on public.events for insert to authenticated
    with check (public.current_user_has_permission('events.create'));
create policy events_update_authorized
    on public.events for update to authenticated
    using (public.current_user_has_permission('events.edit'))
    with check (public.current_user_has_permission('events.edit'));
create policy events_delete_authorized
    on public.events for delete to authenticated
    using (public.current_user_has_permission('events.delete'));

-- Remaining authorization internals are restricted to administrators.
create policy permission_overrides_select_authorized
    on public.permission_overrides for select to authenticated
    using (
        user_id = (select auth.uid())
        or public.current_user_has_permission('roles.view')
    );
create policy audit_logs_select_authorized
    on public.audit_logs for select to authenticated
    using (public.current_user_has_permission('admin.audit'));

-- Published summaries are readable only for accessible events. Drafts require
-- Wrapped administration. Direct writes remain backend-only.
create policy event_summaries_select_authorized
    on public.event_summaries for select to authenticated
    using (
        (
            status = 'published'
            and public.current_user_has_permission('wrapped.view_published')
            and public.current_user_can_access_event(event_id)
        )
        or public.current_user_has_permission('wrapped.view_all')
        or public.current_user_has_permission('wrapped.generate')
    );

create policy event_summary_requests_select_authorized
    on public.event_summary_requests for select to authenticated
    using (
        requested_by = (select auth.uid())
        or public.current_user_has_permission('wrapped.approve')
    );
create policy event_summary_requests_insert_authorized
    on public.event_summary_requests for insert to authenticated
    with check (
        requested_by = (select auth.uid())
        and public.current_user_has_permission('wrapped.request')
        and public.current_user_can_access_event(event_id)
    );

create policy event_agendas_select_authorized
    on public.event_agendas for select to authenticated
    using (
        public.current_user_has_permission('agenda.view_all')
        or public.current_user_has_permission('agenda.generate')
        or exists (
            select 1
            from public.events e
            where e.id = event_agendas.event_id
              and public.current_user_has_permission(
                  'agenda.view_committee',
                  e.managing_committee_id,
                  e.id
              )
        )
    );

create policy notifications_select_own
    on public.notifications for select to authenticated
    using (
        recipient_user_id = (select auth.uid())
        and public.current_user_has_permission('notifications.view_own')
    );
create policy notifications_update_own
    on public.notifications for update to authenticated
    using (
        recipient_user_id = (select auth.uid())
        and public.current_user_has_permission('notifications.view_own')
    )
    with check (recipient_user_id = (select auth.uid()));

create policy debrief_participants_select_authorized
    on public.debrief_participants for select to authenticated
    using (
        user_id = (select auth.uid())
        or public.current_user_has_permission('debrief.view_all')
        or public.current_user_has_permission('attendance.view_all')
        or exists (
            select 1
            from public.events e
            where e.id = debrief_participants.event_id
              and public.current_user_has_permission(
                  'debrief.view_committee',
                  e.managing_committee_id,
                  e.id
              )
        )
    );

-- ---------------------------------------------------------------------------
-- Grants: RLS is evaluated only after table privileges
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;

grant select on public.profiles to authenticated;
grant update (full_name, status) on public.profiles to authenticated;

grant select on public.roles, public.permissions, public.role_permissions to authenticated;
grant select, insert, update, delete on public.user_roles to authenticated;
grant select, insert, update, delete on public.committees to authenticated;
grant select, insert, update, delete on public.committee_memberships to authenticated;
grant select, insert, update, delete on public.events to authenticated;
grant select on public.permission_overrides, public.audit_logs to authenticated;
grant select on public.event_summaries to authenticated;
grant select, insert on public.event_summary_requests to authenticated;
grant select on public.event_agendas to authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant select on public.debrief_participants to authenticated;

comment on table public.profiles is
    'Application identity keyed to auth.users; authorization is normalized through user_roles.';
comment on table public.roles is
    'Protected hierarchy: AC/President (100), ASBO (80), Committee Head (50), Member (10).';
