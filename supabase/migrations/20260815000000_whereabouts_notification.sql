-- Add a real preference row for direct whereabouts pings.

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
        'whereabouts_ping'
    ));
