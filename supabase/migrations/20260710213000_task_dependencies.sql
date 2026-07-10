/*
  # Task dependencies (blocked-by)
  A task can be blocked by other tasks. Membership-gated RLS.
*/
create table if not exists public.task_dependencies (
  task_id uuid not null references public.tasks(id) on delete cascade,
  blocked_by_task_id uuid not null references public.tasks(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (task_id, blocked_by_task_id),
  constraint no_self_block check (task_id <> blocked_by_task_id)
);
create index if not exists task_dependencies_task_idx on public.task_dependencies(task_id);
alter table public.task_dependencies enable row level security;

drop policy if exists td_select on public.task_dependencies;
create policy td_select on public.task_dependencies for select to authenticated
using (project_id in (select id from projects where user_id = auth.uid())
       or project_id in (select project_id from user_accessible_projects where accessor_id = auth.uid()));

drop policy if exists td_insert on public.task_dependencies;
create policy td_insert on public.task_dependencies for insert to authenticated
with check (project_id in (select id from projects where user_id = auth.uid())
       or project_id in (select project_id from user_accessible_projects where accessor_id = auth.uid()));

drop policy if exists td_delete on public.task_dependencies;
create policy td_delete on public.task_dependencies for delete to authenticated
using (project_id in (select id from projects where user_id = auth.uid())
       or project_id in (select project_id from user_accessible_projects where accessor_id = auth.uid()));
