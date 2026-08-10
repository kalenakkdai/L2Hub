-- iCal subscription feed for The Quad.
--
-- NOT APPLIED. This file is written but has never been pushed — see the note
-- at the end of this comment before running anything.
--
-- Two things are added:
--
--   1. campsite_settings.feed_token — the credential for the feed. Google
--      Calendar, Apple Calendar and Outlook fetch a subscription URL with no
--      Authorization header and no cookie jar, so the only thing that can
--      authenticate the request is the URL itself. The token is therefore a
--      bearer credential in a query string: anyone holding the URL sees every
--      event. That is the same trade Google Calendar's own "secret address in
--      iCal format" makes, and it is why the column is rotatable.
--
--      256 bits from two gen_random_uuid() calls rather than one. A single
--      UUIDv4 carries 122 bits of entropy, which is plenty against guessing,
--      but the concatenation costs nothing and removes the question. This
--      deliberately avoids pgcrypto's gen_random_bytes: gen_random_uuid() is
--      core in PostgreSQL 13+, so nothing here depends on an extension being
--      enabled in a particular schema.
--
--      Hex only, so the token survives a URL, a QR code, and being read aloud.
--      base64 would be shorter and would also contain '+' and '/'.
--
--   2. events.description and events.location — the iCal DESCRIPTION and
--      LOCATION properties. The events table had neither; the feed would
--      otherwise emit a calendar of bare titles. Both are nullable, because
--      every existing row has no value for them and a NOT NULL column with a
--      backfilled empty string would be a lie about what is known.
--
-- The feed is per-Campsite, and the Campsite is a singleton — see the header
-- of 20260809000000_settings.sql. One token covers both the whole-Campsite
-- feed and the per-Committee feeds; a Committee feed is a filtered view of
-- the same calendar, not a separate grant. If per-Committee revocation is
-- ever needed, that is a token column on committees and a migration of its
-- own.
--
-- SHARED PROJECT. This database is shared with Kalena. Apply to the local
-- stack first and only push once the feed has been exercised there.

-- ---------------------------------------------------------------------------
-- campsite_settings.feed_token
-- ---------------------------------------------------------------------------

alter table public.campsite_settings
    add column if not exists feed_token text;

-- Backfill before the NOT NULL. The singleton row already exists, so adding
-- the column with a default would leave it null on that one row.
update public.campsite_settings
set feed_token = replace(gen_random_uuid()::text, '-', '')
              || replace(gen_random_uuid()::text, '-', '')
where feed_token is null;

alter table public.campsite_settings
    alter column feed_token set not null,
    alter column feed_token set default (
        replace(gen_random_uuid()::text, '-', '')
        || replace(gen_random_uuid()::text, '-', '')
    );

do $$
begin
    if not exists (
        select 1 from pg_constraint where conname = 'campsite_settings_feed_token_key'
    ) then
        alter table public.campsite_settings
            add constraint campsite_settings_feed_token_key unique (feed_token);
    end if;
end;
$$;

comment on column public.campsite_settings.feed_token is
    'Bearer credential for the iCal subscription feed, passed as ?token=. '
    'Anyone holding it can read every event, so it is rotatable: overwrite it '
    'and every previously shared subscription URL stops resolving.';

-- ---------------------------------------------------------------------------
-- events.description / events.location
-- ---------------------------------------------------------------------------

alter table public.events
    add column if not exists description text,
    add column if not exists location    text;

comment on column public.events.description is
    'Free text shown as the iCal DESCRIPTION. The feed appends the managing '
    'Committee name to this rather than storing it here, so a Committee rename '
    'does not leave stale text behind.';
comment on column public.events.location is
    'Free text shown as the iCal LOCATION. Null means the event has no known '
    'location and the property is omitted entirely — an empty LOCATION renders '
    'as a blank map pin in Google Calendar.';

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------

-- The feed is served by the backend using the service key, which bypasses RLS.
-- No browser role needs to read feed_token: the settings page gets the
-- subscribe URL from an authenticated API route that checks SETTINGS_EDIT, not
-- by selecting the column over PostgREST. Granting it to `authenticated` would
-- hand every signed-in camper a credential that outlives their session.
revoke select (feed_token) on public.campsite_settings from authenticated;

-- Editing an event's description and location is an ordinary staff edit and
-- goes through the API, which already checks EVENTS_EDIT. Nothing is granted
-- to `authenticated` here.
