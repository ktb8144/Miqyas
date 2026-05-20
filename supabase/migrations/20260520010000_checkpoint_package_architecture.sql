-- Checkpoint cleanup for V0.2 package workflow.
-- Keeps existing data, moves package answer keys to package_questions, and adds safe package/class states.

alter table public.assessment_packages
add column if not exists assessment_code text;

create unique index if not exists assessment_packages_assessment_code_idx
on public.assessment_packages(assessment_code)
where assessment_code is not null;

alter table public.package_questions
add column if not exists domain_text text,
add column if not exists skill_text text,
add column if not exists options_json jsonb not null default '{}'::jsonb;

alter table public.school_package_assignments
drop constraint if exists school_package_assignments_status_check;

alter table public.school_package_assignments
add constraint school_package_assignments_status_check
check (status in ('available', 'active', 'completed', 'hidden', 'withdrawn'));

alter table public.class_package_assignments
drop constraint if exists class_package_assignments_status_check;

alter table public.class_package_assignments
add constraint class_package_assignments_status_check
check (status in ('assigned', 'printed', 'in_progress', 'scanned', 'completed', 'withdrawn'));

create unique index if not exists class_package_assignments_package_class_idx
on public.class_package_assignments(package_id, class_id);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  school_id uuid references public.schools(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_actor_created_idx
on public.audit_logs(actor_user_id, created_at desc);

create index if not exists audit_logs_entity_idx
on public.audit_logs(entity_type, entity_id, created_at desc);

alter table public.audit_logs enable row level security;
alter table public.audit_logs force row level security;

drop policy if exists "audit_logs_admin_all" on public.audit_logs;
drop policy if exists "audit_logs_school_staff_read_school" on public.audit_logs;

create policy "audit_logs_admin_all"
on public.audit_logs for all
using (public.app_role() = 'admin' or auth.role() = 'service_role')
with check (public.app_role() = 'admin' or auth.role() = 'service_role');

create policy "audit_logs_school_staff_read_school"
on public.audit_logs for select
using (
  public.app_role() in ('principal', 'supervisor')
  and school_id = public.app_school_id()
);

create or replace function public.validate_package_publish_ready()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'published' then
    if exists (
      select 1
      from public.package_questions q
      where q.package_id = new.id
        and (
          (q.skill_id is null and nullif(q.skill_text, '') is null)
          or (q.nafs_domain_id is null and nullif(q.domain_text, '') is null)
        )
    ) then
      raise exception 'Published packages cannot contain questions without skill/domain mapping';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.validate_package_question_mapping()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  package_status text;
begin
  select status into package_status
  from public.assessment_packages
  where id = new.package_id;

  if package_status = 'published' and (
    (new.skill_id is null and nullif(new.skill_text, '') is null)
    or (new.nafs_domain_id is null and nullif(new.domain_text, '') is null)
  ) then
    raise exception 'Questions in a published package must have skill/domain mapping';
  end if;

  return new;
end;
$$;

notify pgrst, 'reload schema';
