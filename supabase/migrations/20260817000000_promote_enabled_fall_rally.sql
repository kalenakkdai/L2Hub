-- Existing enabled Event Planning fixture promoted into the shared Events catalog.
-- Future approvals use POST /events/from-plan; this backfills the already-enabled plan.

insert into public.events (
    id,
    name,
    slug,
    year,
    status,
    starts_at,
    ends_at
)
values (
    '55555555-5555-4555-8555-555555555555',
    'Fall Rally',
    'event-plan-4c7953f5fc2853429cfac21324fafd5d',
    2026,
    'active',
    '2026-09-12T00:00:00Z',
    '2026-09-13T00:00:00Z'
)
on conflict (slug) do update
set
    name = excluded.name,
    year = excluded.year,
    status = case
        when public.events.status = 'complete' then public.events.status
        else excluded.status
    end,
    starts_at = excluded.starts_at,
    ends_at = excluded.ends_at;