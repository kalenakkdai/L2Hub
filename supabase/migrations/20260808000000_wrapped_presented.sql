-- Record when an Event Wrapped was walked through with the class.
--
-- The per-event recap on the events list stays hidden until this is set, so a
-- summary can never be read ahead of the class review. The timestamp is
-- written by the API from the server clock; clients never supply it.

alter table public.event_summaries
    add column if not exists presented_at timestamptz;

alter table public.event_summaries
    add column if not exists presented_by uuid references public.profiles(id) on delete set null;
