/*
  # Checklists / subtasks on tasks
  task_checklist_items with membership RLS (needs UPDATE too, for toggling done).
*/
create table if not exists public.task_checklist_items (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  text text not null,
  is_done boolean not null default false,
  position int not null default 0,
  created_at timestamptz default now()
);
create index if not exists task_checklist_task_idx on public.task_checklist_items(task_id);
alter table public.task_checklist_items enable row level security;

drop policy if exists tci_select on public.task_checklist_items;
create policy tci_select on public.task_checklist_items for select to authenticated
using (project_id in (select id from projects where user_id = auth.uid())
       or project_id in (select project_id from user_accessible_projects where accessor_id = auth.uid()));

drop policy if exists tci_insert on public.task_checklist_items;
create policy tci_insert on public.task_checklist_items for insert to authenticated
with check (project_id in (select id from projects where user_id = auth.uid())
       or project_id in (select project_id from user_accessible_projects where accessor_id = auth.uid()));

drop policy if exists tci_update on public.task_checklist_items;
create policy tci_update on public.task_checklist_items for update to authenticated
using (project_id in (select id from projects where user_id = auth.uid())
       or project_id in (select project_id from user_accessible_projects where accessor_id = auth.uid()))
with check (project_id in (select id from projects where user_id = auth.uid())
       or project_id in (select project_id from user_accessible_projects where accessor_id = auth.uid()));

drop policy if exists tci_delete on public.task_checklist_items;
create policy tci_delete on public.task_checklist_items for delete to authenticated
using (project_id in (select id from projects where user_id = auth.uid())
       or project_id in (select project_id from user_accessible_projects where accessor_id = auth.uid()));
