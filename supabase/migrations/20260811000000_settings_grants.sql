-- Grant campers permission to write their own settings.
--
-- The settings migration added the columns and the RLS policies but never the
-- table-level privilege, so every write from the browser failed with
-- "permission denied for table profiles". RLS narrows what a role may touch;
-- it cannot grant access the role was never given. Both are required.
--
-- The grant is column-scoped rather than a blanket UPDATE. A camper editing
-- their own row should be able to change their display name and preferences,
-- and should not be able to change their email, their status, or their
-- verification flags — those are set by the auth sync and by staff. Triggers
-- already refuse the verification flags; this makes the same rule true at the
-- privilege level, where it does not depend on a trigger staying installed.

grant update (
    display_name,
    pronouns,
    grade_year,
    avatar_url,
    phone,
    theme,
    reduce_motion,
    compact_density,
    quiet_hours_start,
    quiet_hours_end,
    notifications_paused
) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Trim the privileges Supabase grants new tables by default
-- ---------------------------------------------------------------------------

-- New tables in the public schema arrive with everything granted to
-- authenticated, including TRUNCATE. Nothing needs that, and a privilege
-- nobody uses is only ever a liability.
revoke truncate, references, trigger on public.notification_preferences from authenticated;
revoke truncate, references, trigger on public.campsite_settings from authenticated;

-- The singleton is created by migration and removed by nobody. RLS already
-- has no insert or delete policy; this removes the privilege as well, so the
-- two agree.
revoke insert, delete on public.campsite_settings from authenticated;
