-- Supabase Security Advisor cleanup.
-- This migration hardens helper functions and removes broad public listing
-- from the assessment-files storage bucket without changing app UI.

create or replace function public.app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.users
  where auth_id = auth.uid()
  limit 1
$$;

create or replace function public.app_school_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select school_id
  from public.users
  where auth_id = auth.uid()
  limit 1
$$;

create or replace function public.app_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.users
  where auth_id = auth.uid()
  limit 1
$$;

create or replace function public.is_admin_or_service()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.role(), '') = 'service_role'
    or public.app_role() = 'admin'
$$;

create or replace function public.prevent_school_id_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin_or_service() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.school_id is distinct from public.app_school_id() then
      raise exception 'Changing school_id is not allowed';
    end if;
  end if;

  if tg_op = 'UPDATE' then
    if new.school_id is distinct from old.school_id then
      raise exception 'Changing school_id is not allowed';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.set_weekly_plans_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- These helper functions are used by RLS policies for authenticated users.
-- PostgreSQL grants EXECUTE to PUBLIC by default, so revoke PUBLIC first.
revoke execute on function public.app_role() from public;
revoke execute on function public.app_school_id() from public;
revoke execute on function public.app_user_id() from public;
revoke execute on function public.is_admin_or_service() from public;
revoke execute on function public.prevent_school_id_change() from public;

revoke execute on function public.app_role() from anon;
revoke execute on function public.app_school_id() from anon;
revoke execute on function public.app_user_id() from anon;
revoke execute on function public.is_admin_or_service() from anon;
revoke execute on function public.prevent_school_id_change() from anon;

-- Keep authenticated execution because existing RLS policies call these helpers.
grant execute on function public.app_role() to authenticated;
grant execute on function public.app_school_id() to authenticated;
grant execute on function public.app_user_id() to authenticated;
grant execute on function public.is_admin_or_service() to authenticated;
grant execute on function public.prevent_school_id_change() to authenticated;

grant execute on function public.app_role() to service_role;
grant execute on function public.app_school_id() to service_role;
grant execute on function public.app_user_id() to service_role;
grant execute on function public.is_admin_or_service() to service_role;
grant execute on function public.prevent_school_id_change() to service_role;

-- Remove broad object listing from assessment-files.
-- Admin upload/update/delete policies remain in place.
drop policy if exists "assessment_files_public_read" on storage.objects;
drop policy if exists "assessment_files_authenticated_read_questions" on storage.objects;

create policy "assessment_files_authenticated_read_questions"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'assessment-files'
  and (storage.foldername(name))[1] = 'packages'
  and right(name, length('/questions.pdf')) = '/questions.pdf'
);

notify pgrst, 'reload schema';
