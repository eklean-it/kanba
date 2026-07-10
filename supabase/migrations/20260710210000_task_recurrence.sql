-- Recurring tasks: on completion the app spawns the next occurrence.
alter table public.tasks add column if not exists recurrence text default 'none';
