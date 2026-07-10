/*
  # Labels (colored tags) on tasks

  - labels: per-project named colored tags
  - task_labels: join (task <-> label), project_id denormalized for RLS
  - membership-gated RLS on both, matching task_assignees / task_attachments.
*/

create table if not exists public.labels (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  color text not null default 'gray',
  created_at timestamptz default now()
);
create index if not exists labels_project_idx on public.labels(project_id);
alter table public.labels enable row level security;

create table if not exists public.task_labels (
  task_id uuid not null references public.tasks(id) on delete cascade,
  label_id uuid not null references public.labels(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  primary key (task_id, label_id)
);
create index if not exists task_labels_task_idx on public.task_labels(task_id);
alter table public.task_labels enable row level security;

-- helper predicate inlined per policy (owner OR member via matview)
do $$
declare
  t text;
begin
  foreach t in array array['labels','task_labels'] loop
    execute format('drop policy if exists %I_select on public.%I', t, t);
    execute format($f$create policy %I_select on public.%I for select to authenticated
      using (project_id in (select id from projects where user_id = auth.uid())
             or project_id in (select project_id from user_accessible_projects where accessor_id = auth.uid()))$f$, t, t);
    execute format('drop policy if exists %I_insert on public.%I', t, t);
    execute format($f$create policy %I_insert on public.%I for insert to authenticated
      with check (project_id in (select id from projects where user_id = auth.uid())
             or project_id in (select project_id from user_accessible_projects where accessor_id = auth.uid()))$f$, t, t);
    execute format('drop policy if exists %I_delete on public.%I', t, t);
    execute format($f$create policy %I_delete on public.%I for delete to authenticated
      using (project_id in (select id from projects where user_id = auth.uid())
             or project_id in (select project_id from user_accessible_projects where accessor_id = auth.uid()))$f$, t, t);
  end loop;
end $$;
