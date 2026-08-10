-- Give the "Owl customization paused" notice its own preference switch.
--
-- owl.access_revoked has shipped since the Owl rewards feature landed, but the
-- notification_preferences check constraint never learned the event type, so
-- the settings grid could not offer a way to switch it off. This adds it.

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
        'gradebook_requests',
        'owl_access'
    ));
