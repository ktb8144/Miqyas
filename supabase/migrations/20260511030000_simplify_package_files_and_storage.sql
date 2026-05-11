alter table public.assessment_packages
add column if not exists questions_pdf_url text;

alter table public.package_questions
add column if not exists remediation_note text;

insert into storage.buckets (id, name, public)
values ('assessment-files', 'assessment-files', true)
on conflict (id) do update set public = true;

drop policy if exists "assessment_files_admin_upload" on storage.objects;
drop policy if exists "assessment_files_admin_update" on storage.objects;
drop policy if exists "assessment_files_admin_delete" on storage.objects;
drop policy if exists "assessment_files_public_read" on storage.objects;

create policy "assessment_files_public_read" on storage.objects
for select using (bucket_id = 'assessment-files');

create policy "assessment_files_admin_upload" on storage.objects
for insert with check (
  bucket_id = 'assessment-files'
  and public.app_role() = 'admin'
);

create policy "assessment_files_admin_update" on storage.objects
for update using (
  bucket_id = 'assessment-files'
  and public.app_role() = 'admin'
) with check (
  bucket_id = 'assessment-files'
  and public.app_role() = 'admin'
);

create policy "assessment_files_admin_delete" on storage.objects
for delete using (
  bucket_id = 'assessment-files'
  and public.app_role() = 'admin'
);

notify pgrst, 'reload schema';
