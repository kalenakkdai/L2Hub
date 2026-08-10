-- Add a real preference row for direct whereabouts pings.
--
-- Renumbered from 20260815000000. That version was already recorded in the
-- shared project by the L2 Board migration, and Supabase keys
-- schema_migrations on the version alone — so this file would have been
-- skipped silently and whereabouts pings would never have had a preference
-- row. It now sorts after the board work, which is why committee_request
-- appears in the list below: this constraint is rewritten wholesale, and
-- dropping a value the board relies on would break request notifications.

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
        'whereabouts_ping'
    ));
