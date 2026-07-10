/*
  # Task attachments (files / images on task cards)

  - Private Storage bucket `task-attachments`; object path = {project_id}/{task_id}/{filename}
  - `task_attachments` metadata table linked to task + project
  - RLS on both the table and storage.objects, gated by project membership
    (owner OR member via the user_accessible_projects materialized view),
    matching the pattern used by the columns/tasks policies.
*/

-- Private bucket (25 MB per file)
insert into storage.buckets (id, name, public, file_size_limit)
values ('task-attachments', 'task-attachments', false, 26214400)
on conflict (id) do nothing;

create table if not exists public.task_attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);
create index if not exists task_attachments_task_id_idx on public.task_attachments(task_id);
create index if not exists task_attachments_project_id_idx on public.task_attachments(project_id);

alter table public.task_attachments enable row level security;

drop policy if exists task_attachments_select on public.task_attachments;
create policy task_attachments_select on public.task_attachments for select to authenticated
using (
  project_id in (select id from projects where user_id = auth.uid())
  or project_id in (select project_id from user_accessible_projects where accessor_id = auth.uid())
);

drop policy if exists task_attachments_insert on public.task_attachments;
create policy task_attachments_insert on public.task_attachments for insert to authenticated
with check (
  uploaded_by = auth.uid()
  and (
    project_id in (select id from projects where user_id = auth.uid())
    or project_id in (select project_id from user_accessible_projects where accessor_id = auth.uid())
  )
);

drop policy if exists task_attachments_delete on public.task_attachments;
create policy task_attachments_delete on public.task_attachments for delete to authenticated
using (
  project_id in (select id from projects where user_id = auth.uid())
  or project_id in (select project_id from user_accessible_projects where accessor_id = auth.uid())
);

-- storage.objects policies. First path segment is the project id.
drop policy if exists task_attach_objects_select on storage.objects;
create policy task_attach_objects_select on storage.objects for select to authenticated
using (
  bucket_id = 'task-attachments'
  and (
    ((storage.foldername(storage.objects.name))[1])::uuid in (select id from projects where user_id = auth.uid())
    or ((storage.foldername(storage.objects.name))[1])::uuid in (select project_id from user_accessible_projects where accessor_id = auth.uid())
  )
);

drop policy if exists task_attach_objects_insert on storage.objects;
create policy task_attach_objects_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'task-attachments'
  and (
    ((storage.foldername(storage.objects.name))[1])::uuid in (select id from projects where user_id = auth.uid())
    or ((storage.foldername(storage.objects.name))[1])::uuid in (select project_id from user_accessible_projects where accessor_id = auth.uid())
  )
);

drop policy if exists task_attach_objects_delete on storage.objects;
create policy task_attach_objects_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'task-attachments'
  and (
    ((storage.foldername(storage.objects.name))[1])::uuid in (select id from projects where user_id = auth.uid())
    or ((storage.foldername(storage.objects.name))[1])::uuid in (select project_id from user_accessible_projects where accessor_id = auth.uid())
  )
);
