-- Deadline reminders: the dedupe ledger, and the schedule that drives it.
--
-- Version numbering matters here. Supabase keys schema_migrations on the
-- version alone, so a file reusing a version the project has already recorded
-- is skipped in silence — the lesson 20260819000000 was renumbered to learn.
-- 20260822000000 is unused.

-- ---------------------------------------------------------------------------
-- 1. Dedupe key
-- ---------------------------------------------------------------------------
--
-- Every other notification in the app is edge-triggered: something happens and
-- the code that made it happen raises a notice. A deadline is not an event, so
-- the sweep re-reads every open task every morning and works out which
-- milestone today is. Without a key that would re-send the same reminder daily.
--
-- The notification row is its own receipt. A notice suppressed by quiet hours
-- or a switched-off preference writes no row, leaves no key, and is retried at
-- the next milestone rather than being recorded as sent and lost.
--
-- Consequence worth knowing before writing any retention job: anything that
-- deletes old notifications must leave rows with a dedupe_key alone, or the
-- sweep will send them all again.
alter table public.notifications add column if not exists dedupe_key text;

create unique index if not exists notifications_dedupe_key_uidx
    on public.notifications (recipient_user_id, dedupe_key)
    where dedupe_key is not null;

-- The column grants are unchanged on purpose: `authenticated` may select
-- notifications and update only read_at. That is now a security property
-- rather than hygiene — being able to insert a notification would mean being
-- able to permanently silence someone else's deadline reminders by planting
-- their dedupe key first.

-- ---------------------------------------------------------------------------
-- 2. Schedule
-- ---------------------------------------------------------------------------
--
-- pg_cron owns *when*; the backend owns *what*. The preference gating, the
-- quiet-hours comparison and the email templating are all Python, and
-- reimplementing them in SQL would leave two copies to drift apart. So the
-- schedule does nothing but make one authenticated HTTP call.

create extension if not exists pg_cron with schema cron;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

create schema if not exists jobs;

-- The backend URL and the shared secret live in Vault and are set by hand,
-- once per environment:
--
--   select vault.create_secret('https://l2hub-api.onrender.com', 'l2hub_backend_url');
--   select vault.create_secret('<32 random bytes, base64>',      'l2hub_job_secret');
--
-- They are read at execution time rather than interpolated into the schedule.
-- This file is committed, so an inline secret would leak into the repo — and
-- cron.job stores its command as readable text, so putting it there would just
-- move the leak from a file into a table.
create or replace function jobs.run_deadline_reminders()
returns void
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
    base_url   text;
    job_secret text;
    request_id bigint;
begin
    select decrypted_secret into base_url
      from vault.decrypted_secrets where name = 'l2hub_backend_url';
    select decrypted_secret into job_secret
      from vault.decrypted_secrets where name = 'l2hub_job_secret';

    -- A missing secret is a loud no-op, never a request with a null header.
    -- This is what makes it safe to push the migration before the secrets are
    -- set: the first tick warns and returns instead of failing or, worse,
    -- calling the endpoint unauthenticated.
    if base_url is null or job_secret is null then
        raise warning 'deadline reminders skipped: vault secrets are not set';
        return;
    end if;

    select net.http_post(
        url     := base_url || '/internal/jobs/deadline-reminders',
        headers := jsonb_build_object(
                       'Content-Type', 'application/json',
                       'X-L2Hub-Job-Secret', job_secret),
        body    := '{}'::jsonb,
        timeout_milliseconds := 55000
    ) into request_id;
end;
$$;

revoke all on function jobs.run_deadline_reminders() from public, anon, authenticated;

-- Unschedule first so a rename cannot orphan the old job.
select cron.unschedule('l2hub-deadline-reminders')
where exists (select 1 from cron.job where jobname = 'l2hub-deadline-reminders');

-- pg_cron reads schedules in the database timezone, which is UTC on Supabase.
-- 15:00 UTC is 08:00 America/Los_Angeles under PDT and 07:00 under PST, so it
-- lands before class either way (attendance_class_start is 08:00). A fixed UTC
-- hour drifts by one across the DST boundary; that is accepted rather than
-- worked around, because two schedules and a guard cost more than they buy.
select cron.schedule(
    'l2hub-deadline-reminders',
    '0 15 * * *',
    $$select jobs.run_deadline_reminders()$$
);

-- Checking on it, remembering that pg_net is fire-and-forget and prunes its
-- responses — the backend's own log line is the durable record:
--
--   select * from cron.job_run_details order by start_time desc limit 5;
--   select * from net._http_response order by created desc limit 5;
