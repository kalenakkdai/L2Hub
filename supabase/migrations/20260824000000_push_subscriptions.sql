-- Web push subscriptions.
--
-- NOT APPLIED. Written for review only — this database is shared with Kalena
-- and nothing here has been pushed to it.
--
-- One row per browser, not per camper. A camper with a laptop, a phone added
-- to their home screen, and a school Chromebook has three independent
-- subscriptions, each with its own endpoint and its own keys, and each of
-- which dies independently when that browser clears site data. `profiles`
-- could not hold this as a column without inventing a "primary device" that
-- does not exist.
--
-- What a subscription actually is, per the W3C Push API:
--
--   * endpoint — an opaque URL at the browser vendor's push service
--     (fcm.googleapis.com for Chrome, *.notify.windows.com for Edge,
--     web.push.apple.com for Safari). Posting to it is what delivers a
--     message. It is globally unique, which is why it carries the unique
--     constraint rather than (profile_id, endpoint).
--   * p256dh — the client's public key for payload encryption.
--   * auth — a shared secret used by the same encryption.
--
-- The two keys are not credentials the server can use to impersonate anyone;
-- they only let this server encrypt a payload the browser can decrypt. The
-- endpoint is the sensitive part: anyone holding it and our VAPID private key
-- can push to that browser. VAPID's private half never enters this database
-- and never enters the repo — see PUSH_VAPID_PRIVATE_KEY in backend/.env.

-- ---------------------------------------------------------------------------
-- push_subscriptions
-- ---------------------------------------------------------------------------

create table if not exists public.push_subscriptions (
    id           uuid primary key default gen_random_uuid(),
    profile_id   uuid not null references public.profiles(id) on delete cascade,

    -- Globally unique across every browser on earth. A re-subscribe in the
    -- same browser usually returns the SAME endpoint, so the upsert path
    -- depends on this constraint to avoid accumulating duplicates.
    endpoint     text not null unique,
    p256dh       text not null,
    auth         text not null,

    -- Purely so a camper can tell their devices apart when revoking one.
    -- Never parsed, never branched on.
    user_agent   text,

    created_at   timestamptz not null default now(),
    -- Stamped on every successful send. A subscription that has not been
    -- written to in months is usually a browser that was reinstalled without
    -- ever returning a 410.
    last_used_at timestamptz
);

create index if not exists push_subscriptions_profile_id_idx
    on public.push_subscriptions (profile_id);

comment on table public.push_subscriptions is
    'One row per browser per camper. Deleted by the sender on a 404 or 410 '
    'from the push service, which is the only reliable signal that a '
    'subscription is dead.';
comment on column public.push_subscriptions.endpoint is
    'Opaque push-service URL. Holding this plus the VAPID private key is '
    'enough to push to that browser, so it is never exposed to other campers.';

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.push_subscriptions enable row level security;

-- A camper sees and manages only their own devices. There is deliberately no
-- staff-read policy: an administrator has no reason to read another camper's
-- endpoints, and the backend sends with the service key, which bypasses RLS
-- entirely.
drop policy if exists push_subscriptions_select_own on public.push_subscriptions;
create policy push_subscriptions_select_own
    on public.push_subscriptions for select
    to authenticated
    using (profile_id = (select auth.uid()));

drop policy if exists push_subscriptions_insert_own on public.push_subscriptions;
create policy push_subscriptions_insert_own
    on public.push_subscriptions for insert
    to authenticated
    with check (profile_id = (select auth.uid()));

-- Update exists only so an upsert on the unique endpoint can refresh rotated
-- keys. The browser rotates p256dh/auth without changing the endpoint when a
-- subscription is renewed.
drop policy if exists push_subscriptions_update_own on public.push_subscriptions;
create policy push_subscriptions_update_own
    on public.push_subscriptions for update
    to authenticated
    using (profile_id = (select auth.uid()))
    with check (profile_id = (select auth.uid()));

drop policy if exists push_subscriptions_delete_own on public.push_subscriptions;
create policy push_subscriptions_delete_own
    on public.push_subscriptions for delete
    to authenticated
    using (profile_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------

-- RLS narrows what a role may touch; it cannot grant access the role was
-- never given. Both are required — this is the same trap
-- 20260811000000_settings_grants.sql was written to fix.
grant select, insert, update, delete on public.push_subscriptions to authenticated;

-- Nothing needs these, and an unused privilege is only ever a liability.
revoke truncate, references, trigger on public.push_subscriptions from authenticated;

-- ---------------------------------------------------------------------------
-- notification_preferences: allow the 'push' channel
-- ---------------------------------------------------------------------------

-- The existing check constraint lists ('email', 'sms', 'in_app'). Push reuses
-- the whole preference machinery — per-event-type switches, pause, quiet
-- hours — rather than growing a parallel set of toggles, so the channel has
-- to be a legal value first.
alter table public.notification_preferences
    drop constraint if exists notification_preferences_channel_check;

alter table public.notification_preferences
    add constraint notification_preferences_channel_check
    check (channel in ('email', 'sms', 'in_app', 'push'));
