/*
  # Multi-assignee: task_assignees join table

  A task can be assigned to many people. tasks.assigned_to is kept as a
  denormalized "primary" assignee (first one) for back-compat with the board
  avatar + "assigned to me" query. RLS is project-membership gated, matching
  the task_attachments / columns policies.
*/

create table if not exists public.task_assignees (
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  assigned_at timestamptz default now(),
  primary key (task_id, user_id)
);
create index if not exists task_assignees_user_idx on public.task_assignees(user_id);
create index if not exists task_assignees_project_idx on public.task_assignees(project_id);

alter table public.task_assignees enable row level security;

drop policy if exists task_assignees_select on public.task_assignees;
create policy task_assignees_select on public.task_assignees for select to authenticated
using (
  project_id in (select id from projects where user_id = auth.uid())
  or project_id in (select project_id from user_accessible_projects where accessor_id = auth.uid())
);

drop policy if exists task_assignees_insert on public.task_assignees;
create policy task_assignees_insert on public.task_assignees for insert to authenticated
with check (
  project_id in (select id from projects where user_id = auth.uid())
  or project_id in (select project_id from user_accessible_projects where accessor_id = auth.uid())
);

drop policy if exists task_assignees_delete on public.task_assignees;
create policy task_assignees_delete on public.task_assignees for delete to authenticated
using (
  project_id in (select id from projects where user_id = auth.uid())
  or project_id in (select project_id from user_accessible_projects where accessor_id = auth.uid())
);

-- Backfill from the existing single assignee.
insert into public.task_assignees (task_id, user_id, project_id)
select t.id, t.assigned_to, c.project_id
from public.tasks t
join public.columns c on c.id = t.column_id
where t.assigned_to is not null
on conflict (task_id, user_id) do nothing;
