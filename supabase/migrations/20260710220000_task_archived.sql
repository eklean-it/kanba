-- Archiving: hide tasks from the board without deleting them.
alter table public.tasks add column if not exists archived boolean not null default false;
