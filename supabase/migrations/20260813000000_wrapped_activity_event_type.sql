-- Give the Event Wrapped notifications a preference row of their own.
--
-- The three notifications this codebase actually emits — wrapped.request,
-- wrapped.generated and wrapped.published — were all mapped onto the
-- `event_created` preference, which the settings grid labels "New event
-- created". Switching that row off silenced Wrapped updates, and no event
-- creation notification has ever existed to silence. The row described one
-- thing and gated another.
--
-- The other seven event types keep their place in this constraint. Nothing
-- emits them, so the grid no longer offers them (see SOURCED_EVENT_TYPES in
-- backend/app/services/notifications.py), but campers may already hold rows
-- for them and removing the values would fail against that data.

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
        'wrapped_activity'
    ));

-- ---------------------------------------------------------------------------
-- Carry the existing choice across
-- ---------------------------------------------------------------------------

-- Anyone who switched "New event created" off was, in practice, switching
-- Wrapped updates off — that is all the row has ever gated. Renaming the
-- preference underneath them would quietly switch those notifications back
-- on, so the choice is copied onto the new event type rather than dropped.
--
-- The old rows are left in place. They gate nothing now, and deleting a
-- camper's stored preference is not something a schema change should do.
insert into public.notification_preferences (profile_id, event_type, channel, enabled)
select profile_id, 'wrapped_activity', channel, enabled
from public.notification_preferences
where event_type = 'event_created'
on conflict (profile_id, event_type, channel) do nothing;

comment on column public.notification_preferences.event_type is
    'wrapped_activity gates the Event Wrapped request/generated/published notices, '
    'which are the only notifications this codebase emits. crew_announcement refers '
    'to a committee announcement; the name is retained for compatibility. The task_*, '
    'points_awarded, level_up, event_created and event_starting values have no emitter '
    'and are not offered in the settings grid.';
