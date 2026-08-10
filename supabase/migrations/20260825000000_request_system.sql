-- The cross-Crew request system: custom fields, comments, and a status trail.
--
-- This replaces the Google Form each Crew keeps. It extends the existing
-- `committee_requests` table rather than introducing a parallel `requests`
-- table, because 20260815000000 already shipped that table with live rows,
-- a SQLAlchemy model (backend/app/models/work.py), an API surface, and a
-- Requests page wired to it. A second table would orphan all four.
--
-- Four things this migration adds:
--
--   1. Columns committee_requests was missing: campsite_id, decline_reason,
--      withdrawn_at, and a `withdrawn` status.
--   2. request_field_defs / request_field_values — each Crew declares what it
--      needs in order to act on a request. Publicity wants dimensions and a
--      deadline; Tech wants equipment type; Fundraising wants a budget figure.
--      Crews edit these themselves through the UI. See "Succession" below.
--   3. request_comments — the back-and-forth, so the answer to "what size?"
--      lives on the request instead of in a group chat.
--   4. request_status_history — who moved it, when, and from what.
--
-- Succession note. Everything about the field definitions is data, not code.
-- A Crew head can add, rename, reorder, retire, and re-require fields from the
-- UI without a developer, a migration, or a deploy. That is the reason
-- request_field_defs is a table and not a hardcoded per-Crew form component,
-- and the reason retiring a field archives it rather than deleting it: next
-- year's chair changing the form must not erase last year's answers.

-- ---------------------------------------------------------------------------
-- 1. committee_requests: the columns the request system needs
-- ---------------------------------------------------------------------------

-- campsite_id. There is still no `campsites` table — 20260809000000 pinned
-- campsite_settings to one row and said so explicitly. This column therefore
-- references the singleton and buys a real FK plus a column that already
-- exists on the day multi-tenancy lands, but it is NOT isolation today. The
-- "campsite admins and advisers read everything in their Campsite" rule below
-- is, in a single-tenant schema, the same set as "read everything".
alter table public.committee_requests
    add column if not exists campsite_id uuid
        references public.campsite_settings(id) on delete restrict;

update public.committee_requests
set campsite_id = (select id from public.campsite_settings where singleton)
where campsite_id is null;

alter table public.committee_requests
    alter column campsite_id set not null,
    alter column campsite_id set default (
        select id from public.campsite_settings where singleton
    );

create index if not exists committee_requests_campsite_idx
    on public.committee_requests (campsite_id, status);

-- A decline without a reason is the failure mode this whole system exists to
-- fix: the requester learns "no" and nothing else, and has to go find someone
-- in person anyway. Enforced in the schema, not in a form handler, because the
-- form handler is the layer next year's team is most likely to rewrite.
alter table public.committee_requests
    add column if not exists decline_reason text,
    add column if not exists withdrawn_at   timestamptz,
    add column if not exists withdrawn_by_user_id uuid
        references public.profiles(id) on delete set null;

-- `withdrawn` is not in the four-status enum you specified. It is here because
-- "the sending Crew can withdraw a request" needs somewhere to land, and DELETE
-- on this table is revoked by 20260816000000 on purpose — the request log is a
-- paper trail. Withdrawing therefore closes the row rather than removing it.
-- Drop this from the check constraint if you would rather withdrawal not exist.
alter table public.committee_requests
    drop constraint if exists committee_requests_status_check;

alter table public.committee_requests
    add constraint committee_requests_status_check
    check (status in ('open', 'accepted', 'done', 'declined', 'withdrawn'));

alter table public.committee_requests
    drop constraint if exists committee_requests_decline_reason_required;

alter table public.committee_requests
    add constraint committee_requests_decline_reason_required
    check (
        status <> 'declined'
        or (decline_reason is not null and length(trim(decline_reason)) >= 10)
    );

comment on constraint committee_requests_decline_reason_required
    on public.committee_requests is
    'Declining requires a reason of at least 10 characters. An empty decline '
    'is what makes a request system useless.';

-- ---------------------------------------------------------------------------
-- 2. request_field_defs: what each Crew needs in order to say yes
-- ---------------------------------------------------------------------------

create table if not exists public.request_field_defs (
    id            uuid primary key default gen_random_uuid(),
    committee_id  uuid not null references public.committees(id) on delete cascade,
    label         text not null check (length(trim(label)) > 0),
    help_text     text not null default '',
    field_type    text not null default 'text'
                  check (field_type in (
                      'text',        -- one line
                      'long_text',   -- paragraph
                      'number',
                      'date',
                      'select',      -- one of options
                      'multiselect', -- any of options
                      'checkbox',
                      'url'
                  )),
    -- Only meaningful for select/multiselect. A json array of strings; the
    -- check keeps a malformed value from reaching the form renderer.
    options       jsonb not null default '[]'::jsonb
                  check (jsonb_typeof(options) = 'array'),
    is_required   boolean not null default false,
    display_order integer not null default 0,
    -- Retiring a field hides it from new requests and keeps every answer that
    -- was ever given to it. A Crew chair reorganising the form must not be able
    -- to destroy last year's record by accident.
    archived_at   timestamptz,
    created_by_user_id uuid references public.profiles(id) on delete set null,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now(),

    constraint request_field_defs_options_only_for_choice check (
        field_type in ('select', 'multiselect')
        or jsonb_array_length(options) = 0
    ),
    constraint request_field_defs_choice_needs_options check (
        field_type not in ('select', 'multiselect')
        or jsonb_array_length(options) > 0
    )
);

-- Two live fields on one Crew cannot share a label; the form would be
-- ambiguous and the answers unreadable. Archived ones are exempt, so a Crew can
-- retire "Budget" and later introduce a new "Budget".
create unique index if not exists request_field_defs_live_label_idx
    on public.request_field_defs (committee_id, lower(trim(label)))
    where archived_at is null;

create index if not exists request_field_defs_committee_idx
    on public.request_field_defs (committee_id, display_order)
    where archived_at is null;

create trigger request_field_defs_set_updated_at
    before update on public.request_field_defs
    for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. request_field_values: the answers
-- ---------------------------------------------------------------------------

-- Values are stored as text and cast by the reader. The alternative — a column
-- per type — makes adding a field type a migration, which is exactly the
-- developer dependency this design is trying to remove.
create table if not exists public.request_field_values (
    id            uuid primary key default gen_random_uuid(),
    request_id    uuid not null
                  references public.committee_requests(id) on delete cascade,
    field_def_id  uuid not null
                  references public.request_field_defs(id) on delete restrict,
    value         text not null default '',
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now(),
    unique (request_id, field_def_id)
);

create index if not exists request_field_values_request_idx
    on public.request_field_values (request_id);

create trigger request_field_values_set_updated_at
    before update on public.request_field_values
    for each row execute function public.set_updated_at();

-- A field def belongs to the Crew being asked. Answering Tech's "equipment
-- type" on a request filed to Publicity is a bug the database should not store.
create or replace function public.request_field_value_matches_target()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    target uuid;
    owner  uuid;
begin
    select target_committee_id into target
    from public.committee_requests
    where id = new.request_id;

    select committee_id into owner
    from public.request_field_defs
    where id = new.field_def_id;

    if target is null or owner is null or target <> owner then
        raise exception
            'field def % does not belong to the crew this request was sent to',
            new.field_def_id
            using errcode = 'check_violation';
    end if;

    return new;
end;
$$;

create trigger request_field_values_match_target
    before insert or update on public.request_field_values
    for each row execute function public.request_field_value_matches_target();

-- ---------------------------------------------------------------------------
-- 4. request_comments
-- ---------------------------------------------------------------------------

create table if not exists public.request_comments (
    id            uuid primary key default gen_random_uuid(),
    request_id    uuid not null
                  references public.committee_requests(id) on delete cascade,
    author_user_id uuid references public.profiles(id) on delete set null,
    -- Threading is one level: a reply points at a top-level comment. Deeper
    -- nesting reads badly on a phone and nobody has asked for it.
    parent_id     uuid references public.request_comments(id) on delete cascade,
    body          text not null check (length(trim(body)) > 0),
    edited_at     timestamptz,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);

create index if not exists request_comments_request_idx
    on public.request_comments (request_id, created_at);

create trigger request_comments_set_updated_at
    before update on public.request_comments
    for each row execute function public.set_updated_at();

create or replace function public.request_comment_parent_is_top_level()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    parent_request uuid;
    parent_parent  uuid;
begin
    if new.parent_id is null then
        return new;
    end if;

    select request_id, parent_id into parent_request, parent_parent
    from public.request_comments
    where id = new.parent_id;

    if parent_request is distinct from new.request_id then
        raise exception 'reply must belong to the same request as its parent'
            using errcode = 'check_violation';
    end if;

    if parent_parent is not null then
        raise exception 'comment threading is one level deep'
            using errcode = 'check_violation';
    end if;

    return new;
end;
$$;

create trigger request_comments_parent_is_top_level
    before insert or update on public.request_comments
    for each row execute function public.request_comment_parent_is_top_level();

-- ---------------------------------------------------------------------------
-- 5. request_status_history
-- ---------------------------------------------------------------------------

create table if not exists public.request_status_history (
    id             uuid primary key default gen_random_uuid(),
    request_id     uuid not null
                   references public.committee_requests(id) on delete cascade,
    from_status    text,
    to_status      text not null,
    reason         text,
    changed_by_user_id uuid references public.profiles(id) on delete set null,
    changed_at     timestamptz not null default now()
);

create index if not exists request_status_history_request_idx
    on public.request_status_history (request_id, changed_at);

-- History is written by the database, not by the caller. A client that forgets
-- to log, or edits the log to suit itself, is not a trail worth keeping.
create or replace function public.log_request_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if tg_op = 'INSERT' then
        insert into public.request_status_history
            (request_id, from_status, to_status, changed_by_user_id)
        values (new.id, null, new.status, (select auth.uid()));
        return new;
    end if;

    if new.status is distinct from old.status then
        insert into public.request_status_history
            (request_id, from_status, to_status, reason, changed_by_user_id)
        values (
            new.id,
            old.status,
            new.status,
            case when new.status = 'declined' then new.decline_reason end,
            (select auth.uid())
        );
    end if;

    return new;
end;
$$;

create trigger committee_requests_log_status
    after insert or update on public.committee_requests
    for each row execute function public.log_request_status_change();

-- Backfill the rows that already exist so the detail view is not blank for
-- every request filed before today.
insert into public.request_status_history
    (request_id, from_status, to_status, changed_by_user_id, changed_at)
select r.id, null, 'open', r.created_by_user_id, r.created_at
from public.committee_requests r
where not exists (
    select 1 from public.request_status_history h where h.request_id = r.id
);

-- ---------------------------------------------------------------------------
-- 6. Column-level write split, enforced in a trigger
-- ---------------------------------------------------------------------------

-- Postgres RLS is row-level only. "The sender may edit the request but not its
-- status" and "the recipient may set the status but not rewrite the ask" are
-- column-level rules, so a policy cannot express them and a trigger must.
--
-- Both sides pass the UPDATE policy below; this decides what each may touch.
create or replace function public.enforce_request_write_split()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    is_sender    boolean;
    is_recipient boolean;
    is_override  boolean;
begin
    is_override := public.current_user_has_permission('requests.manage_all');
    if is_override then
        return new;
    end if;

    is_sender := exists (
        select 1 from public.committee_memberships m
        where m.user_id = (select auth.uid())
          and m.committee_id = old.requesting_committee_id
    );
    is_recipient := exists (
        select 1 from public.committee_memberships m
        where m.user_id = (select auth.uid())
          and m.committee_id = old.target_committee_id
    );

    -- Status transitions. accepted / done / declined belong to the Crew that
    -- was asked. withdrawn belongs to the Crew that asked.
    if new.status is distinct from old.status then
        if new.status = 'withdrawn' then
            if not is_sender then
                raise exception 'only the sending crew may withdraw a request'
                    using errcode = 'insufficient_privilege';
            end if;
            if old.status not in ('open', 'accepted') then
                raise exception 'only an open or accepted request may be withdrawn'
                    using errcode = 'check_violation';
            end if;
            new.withdrawn_at := now();
            new.withdrawn_by_user_id := (select auth.uid());
        elsif not is_recipient then
            raise exception
                'only the receiving crew may set a request to %', new.status
                using errcode = 'insufficient_privilege';
        else
            new.responded_by_user_id := (select auth.uid());
            new.responded_at := now();
        end if;
    end if;

    -- Content edits belong to the sender, and only while the request is still
    -- open. Once the other Crew has accepted it, changing the ask underneath
    -- them is how a request system loses people's trust.
    if (new.title, new.details, new.due_on, new.target_committee_id)
       is distinct from
       (old.title, old.details, old.due_on, old.target_committee_id)
    then
        if not is_sender then
            raise exception 'only the sending crew may edit a request'
                using errcode = 'insufficient_privilege';
        end if;
        if old.status <> 'open' then
            raise exception 'a request may only be edited while it is open'
                using errcode = 'check_violation';
        end if;
    end if;

    -- Provenance is not editable by anyone.
    new.requesting_committee_id := old.requesting_committee_id;
    new.created_by_user_id      := old.created_by_user_id;
    new.created_at              := old.created_at;
    new.campsite_id             := old.campsite_id;

    return new;
end;
$$;

create trigger committee_requests_write_split
    before update on public.committee_requests
    for each row execute function public.enforce_request_write_split();

-- ---------------------------------------------------------------------------
-- 7. Permissions
-- ---------------------------------------------------------------------------

insert into public.permissions (key, description, category)
values
    (
        'requests.manage_fields',
        'Define the request fields for own crew',
        'requests'
    ),
    ('requests.comment', 'Comment on a request you can see', 'requests')
on conflict (key) do update
set description = excluded.description,
    category = excluded.category;

-- Every member can comment on a request they can already read. Only heads
-- shape the form — see the RLS policy, which additionally requires that the
-- head heads the Crew whose fields they are editing.
insert into public.role_permissions (role_id, permission_id, effect)
select r.id, p.id, 'allow'
from public.roles r
cross join public.permissions p
where r.slug = 'member'
  and p.key = 'requests.comment'
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id, effect)
select r.id, p.id, 'allow'
from public.roles r
cross join public.permissions p
where r.slug in ('committee_head', 'class_officer', 'asbo', 'ac', 'president')
  and p.key in ('requests.manage_fields', 'requests.comment')
on conflict (role_id, permission_id) do nothing;

-- ---------------------------------------------------------------------------
-- 8. Table-level GRANTs
-- ---------------------------------------------------------------------------

-- RLS decides which rows. These decide whether the table may be touched at
-- all, and the privilege check runs first — without them every policy below is
-- unreachable and every write 403s.
--
-- The reverse hazard is live on this project too: 20260816000000 found that
-- default privileges here hand `all` on new public tables to `authenticated`,
-- so DELETE arrives whether or not it is wanted. Each revoke below is
-- therefore load-bearing, not decoration.

grant select, insert, update, delete on public.request_field_defs to authenticated;

grant select, insert, update, delete on public.request_field_values to authenticated;

-- Comments are editable and removable by their author; that is handled in RLS.
grant select, insert, update, delete on public.request_comments to authenticated;

-- History is append-only and appended by trigger. Callers read it and nothing
-- else. The trigger is SECURITY DEFINER, so it writes without this grant.
grant select on public.request_status_history to authenticated;
revoke insert, update, delete on public.request_status_history from authenticated;

-- service_role bypasses RLS but still needs the privilege bit.
grant all on public.request_field_defs        to service_role;
grant all on public.request_field_values      to service_role;
grant all on public.request_comments          to service_role;
grant all on public.request_status_history    to service_role;

-- ---------------------------------------------------------------------------
-- 9. Row level security
-- ---------------------------------------------------------------------------

alter table public.request_field_defs     enable row level security;
alter table public.request_field_values   enable row level security;
alter table public.request_comments       enable row level security;
alter table public.request_status_history enable row level security;

-- Nothing here should be reachable by an unauthenticated caller, and RLS with
-- no policy for a role is a deny. Stated anyway so the intent survives review.
revoke all on public.request_field_defs        from anon;
revoke all on public.request_field_values      from anon;
revoke all on public.request_comments          from anon;
revoke all on public.request_status_history    from anon;

-- --- helper: may the caller see this request at all? ------------------------

-- Used by all four child tables. Kept as one SECURITY DEFINER function so the
-- visibility rule for a request is written once; a child table that disagrees
-- with its parent about who can read it is a leak waiting to happen.
create or replace function public.current_user_can_see_request(target_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.committee_requests r
        where r.id = target_request_id
          and (
              public.current_user_has_permission('requests.view_all')
              or exists (
                  select 1 from public.committee_memberships m
                  where m.user_id = (select auth.uid())
                    and m.committee_id in (
                        r.requesting_committee_id,
                        r.target_committee_id
                    )
              )
          )
    );
$$;

revoke all on function public.current_user_can_see_request(uuid) from public;
grant execute on function public.current_user_can_see_request(uuid) to authenticated;

-- Reading a request and being in it are different questions, and the whole
-- class can do the first. This is the second: membership of one of the two
-- Crews actually involved. Every write on a request narrows to this, so that
-- "readable by everyone, editable by the two Crews" holds without depending on
-- the reader's permission set.
create or replace function public.current_user_is_party_to_request(target_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.committee_requests r
        join public.committee_memberships m
          on m.committee_id in (
              r.requesting_committee_id,
              r.target_committee_id
          )
        where r.id = target_request_id
          and m.user_id = (select auth.uid())
    );
$$;

revoke all on function public.current_user_is_party_to_request(uuid) from public;
grant execute on function public.current_user_is_party_to_request(uuid) to authenticated;

-- --- request_field_defs -----------------------------------------------------

-- Field definitions are public within the Campsite. They have to be: anyone
-- filing a request needs to see the form of the Crew they are filing to,
-- before they are in any relationship with that Crew.
drop policy if exists request_field_defs_select on public.request_field_defs;
create policy request_field_defs_select
    on public.request_field_defs for select to authenticated
    using (true);

-- Succession lives in this policy. A Crew head editing their own Crew's form
-- needs no developer, no SQL, and no deploy — the UI writes here directly.
drop policy if exists request_field_defs_write on public.request_field_defs;
create policy request_field_defs_write
    on public.request_field_defs for all to authenticated
    using (
        public.current_user_has_permission('requests.manage_all')
        or (
            public.current_user_has_permission('requests.manage_fields')
            and public.current_user_heads_committee(committee_id)
        )
    )
    with check (
        public.current_user_has_permission('requests.manage_all')
        or (
            public.current_user_has_permission('requests.manage_fields')
            and public.current_user_heads_committee(committee_id)
        )
    );

-- --- request_field_values ---------------------------------------------------

drop policy if exists request_field_values_select on public.request_field_values;
create policy request_field_values_select
    on public.request_field_values for select to authenticated
    using (public.current_user_can_see_request(request_id));

-- Answers belong to whoever is asking, and only while the ask is still open.
drop policy if exists request_field_values_write on public.request_field_values;
create policy request_field_values_write
    on public.request_field_values for all to authenticated
    using (
        public.current_user_has_permission('requests.manage_all')
        or exists (
            select 1
            from public.committee_requests r
            join public.committee_memberships m
              on m.committee_id = r.requesting_committee_id
            where r.id = request_field_values.request_id
              and m.user_id = (select auth.uid())
              and r.status = 'open'
        )
    )
    with check (
        public.current_user_has_permission('requests.manage_all')
        or exists (
            select 1
            from public.committee_requests r
            join public.committee_memberships m
              on m.committee_id = r.requesting_committee_id
            where r.id = request_field_values.request_id
              and m.user_id = (select auth.uid())
              and r.status = 'open'
        )
    );

-- --- request_comments -------------------------------------------------------

drop policy if exists request_comments_select on public.request_comments;
create policy request_comments_select
    on public.request_comments for select to authenticated
    using (public.current_user_can_see_request(request_id));

-- Reading the thread is not joining it. The whole class can follow a request,
-- but the conversation belongs to the two Crews in it — otherwise every camper
-- can pile into a negotiation between Publicity and Tech that is nothing to do
-- with them, and the thread stops being usable for the people who need it.
drop policy if exists request_comments_insert on public.request_comments;
create policy request_comments_insert
    on public.request_comments for insert to authenticated
    with check (
        author_user_id = (select auth.uid())
        and (
            public.current_user_has_permission('requests.manage_all')
            or (
                public.current_user_has_permission('requests.comment')
                and public.current_user_is_party_to_request(request_id)
            )
        )
    );

drop policy if exists request_comments_update on public.request_comments;
create policy request_comments_update
    on public.request_comments for update to authenticated
    using (
        author_user_id = (select auth.uid())
        or public.current_user_has_permission('requests.manage_all')
    )
    with check (
        author_user_id = (select auth.uid())
        or public.current_user_has_permission('requests.manage_all')
    );

drop policy if exists request_comments_delete on public.request_comments;
create policy request_comments_delete
    on public.request_comments for delete to authenticated
    using (
        author_user_id = (select auth.uid())
        or public.current_user_has_permission('requests.manage_all')
    );

-- --- request_status_history -------------------------------------------------

-- Read-only to everyone who can see the request. There is deliberately no
-- insert, update or delete policy: the trigger writes it, nobody edits it.
drop policy if exists request_status_history_select on public.request_status_history;
create policy request_status_history_select
    on public.request_status_history for select to authenticated
    using (public.current_user_can_see_request(request_id));

-- ---------------------------------------------------------------------------
-- 10. committee_requests: replace the UPDATE policy
-- ---------------------------------------------------------------------------

-- 20260815000000 let only the receiving Crew update, which locks the sender
-- out of editing and withdrawing their own request. Widen the policy to both
-- sides; enforce_request_write_split above is what keeps the two roles apart
-- at column level.
drop policy if exists committee_requests_update_authorized on public.committee_requests;
create policy committee_requests_update_authorized
    on public.committee_requests for update to authenticated
    using (
        public.current_user_has_permission('requests.manage_all')
        or exists (
            select 1 from public.committee_memberships m
            where m.user_id = (select auth.uid())
              and m.committee_id in (
                  committee_requests.requesting_committee_id,
                  committee_requests.target_committee_id
              )
        )
    )
    with check (
        public.current_user_has_permission('requests.manage_all')
        or exists (
            select 1 from public.committee_memberships m
            where m.user_id = (select auth.uid())
              and m.committee_id in (
                  committee_requests.requesting_committee_id,
                  committee_requests.target_committee_id
              )
        )
    );

comment on table public.request_field_defs is
    'Per-crew request form definitions. Edited by crew heads through the UI: '
    'adding or changing a field must never require a migration.';
comment on table public.request_status_history is
    'Append-only. Written by the log_request_status_change trigger; '
    'authenticated holds SELECT only.';
