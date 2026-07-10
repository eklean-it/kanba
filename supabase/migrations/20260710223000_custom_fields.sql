/*
  # Custom fields
  Project-level field definitions + per-task values. Membership RLS on both.
*/
create table if not exists public.custom_fields (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  type text not null default 'text',
  options jsonb,
  position int not null default 0,
  created_at timestamptz default now()
);
create index if not exists custom_fields_project_idx on public.custom_fields(project_id);
alter table public.custom_fields enable row level security;

create table if not exists public.task_field_values (
  task_id uuid not null references public.tasks(id) on delete cascade,
  field_id uuid not null references public.custom_fields(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  value text,
  updated_at timestamptz default now(),
  primary key (task_id, field_id)
);
create index if not exists task_field_values_task_idx on public.task_field_values(task_id);
alter table public.task_field_values enable row level security;

do $$
declare t text;
begin
  foreach t in array array['custom_fields','task_field_values'] loop
    execute format('drop policy if exists %I_sel on public.%I', t, t);
    execute format($f$create policy %I_sel on public.%I for select to authenticated using (project_id in (select id from projects where user_id=auth.uid()) or project_id in (select project_id from user_accessible_projects where accessor_id=auth.uid()))$f$, t, t);
    execute format('drop policy if exists %I_ins on public.%I', t, t);
    execute format($f$create policy %I_ins on public.%I for insert to authenticated with check (project_id in (select id from projects where user_id=auth.uid()) or project_id in (select project_id from user_accessible_projects where accessor_id=auth.uid()))$f$, t, t);
    execute format('drop policy if exists %I_upd on public.%I', t, t);
    execute format($f$create policy %I_upd on public.%I for update to authenticated using (project_id in (select id from projects where user_id=auth.uid()) or project_id in (select project_id from user_accessible_projects where accessor_id=auth.uid())) with check (project_id in (select id from projects where user_id=auth.uid()) or project_id in (select project_id from user_accessible_projects where accessor_id=auth.uid()))$f$, t, t);
    execute format('drop policy if exists %I_del on public.%I', t, t);
    execute format($f$create policy %I_del on public.%I for delete to authenticated using (project_id in (select id from projects where user_id=auth.uid()) or project_id in (select project_id from user_accessible_projects where accessor_id=auth.uid()))$f$, t, t);
  end loop;
end $$;
