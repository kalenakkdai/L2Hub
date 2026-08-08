-- Let a verification actually stick.
--
-- Two triggers on public.profiles were cancelling each other out, so
-- phone_verified could never become true on a first verification:
--
--   * sync_verification_from_auth mirrors auth.users into profiles, and
--     writes the number and the flag in ONE update — on a first verification
--     the phone arrives at the same instant it is confirmed;
--   * reset_verification_on_contact_change is a BEFORE UPDATE guard that
--     clears the flag whenever the number changes, so it fired on that very
--     statement and reset the `true` the sync had just computed.
--
-- The guard is right to exist: changing a verified number must drop
-- verification, and enforcing it in the database means it holds no matter
-- which client performed the update. It just cannot tell "the camper edited
-- their number" from "Supabase confirmed this number", because both arrive as
-- a phone that differs from the old one.
--
-- Comparing the flags instead of using a marker is not enough. It handles a
-- first verification, but a camper who changes an already-verified number and
-- confirms the new one goes true -> true, which is indistinguishable from an
-- unrelated edit, and the guard would wrongly clear it.
--
-- So the sync says who it is. set_config with is_local => true scopes the
-- marker to the current transaction, and the sync clears it immediately after
-- its own update, so it cannot leak to any other statement in the same
-- transaction.

create or replace function public.sync_verification_from_auth()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    -- Announce that the write below is the auth mirror, not a client edit.
    perform set_config('app.verification_sync', 'on', true);

    update public.profiles
    set email          = coalesce(new.email, email),
        email_verified = new.email_confirmed_at is not null,
        phone          = coalesce(new.phone, phone),
        phone_verified = new.phone_confirmed_at is not null
    where id = new.id;

    perform set_config('app.verification_sync', 'off', true);

    return new;
end;
$$;

create or replace function public.reset_verification_on_contact_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
    -- The auth mirror is authoritative about what is verified. Anything else
    -- changing the number or address is a client edit, and drops it.
    if coalesce(current_setting('app.verification_sync', true), '') = 'on' then
        return new;
    end if;

    if new.phone is distinct from old.phone then
        new.phone_verified := false;
    end if;

    if new.email is distinct from old.email then
        new.email_verified := false;
    end if;

    return new;
end;
$$;

comment on function public.reset_verification_on_contact_change() is
    'Drops verification when a camper changes their own number or address. '
    'Defers to sync_verification_from_auth, which sets the number and the flag '
    'in one statement and would otherwise be cancelled by this guard.';
