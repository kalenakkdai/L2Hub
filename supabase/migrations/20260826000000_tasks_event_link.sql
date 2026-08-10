-- Link L2 Board tasks to events, and mirror collaborator fan-out onto
-- the target committee's board.
--
-- event_id     — optional campsite the work is for (Maze Day, Fall Rally, …)
-- origin_task_id — when Community lists a task and ticks Publicity, Publicity
--                  gets its own board row whose origin points back at Community's.

alter table public.tasks
    add column if not exists event_id uuid
        references public.events(id) on delete set null;

alter table public.tasks
    add column if not exists origin_task_id uuid
        references public.tasks(id) on delete set null;

create index if not exists tasks_event_idx
    on public.tasks (event_id)
    where event_id is not null;

create index if not exists tasks_origin_idx
    on public.tasks (origin_task_id)
    where origin_task_id is not null;
