-- Miqyas strict RLS policies
-- Execution order: schools, users, classes, students, weekly_questions,
-- assessments, results, reports, subscriptions, weekly_sets.

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

-- 1. schools
alter table public.schools enable row level security;
alter table public.schools force row level security;

drop policy if exists "schools_admin_all" on public.schools;
drop policy if exists "schools_staff_read_own" on public.schools;

create policy "schools_admin_all"
on public.schools for all
using (public.is_admin_or_service())
with check (public.is_admin_or_service());

create policy "schools_staff_read_own"
on public.schools for select
using (
  public.app_role() in ('principal', 'supervisor', 'teacher')
  and id = public.app_school_id()
);

-- 2. users
alter table public.users enable row level security;
alter table public.users force row level security;

drop policy if exists "users_admin_all" on public.users;
drop policy if exists "users_principal_supervisor_read_school" on public.users;
drop policy if exists "users_teacher_read_self" on public.users;
drop policy if exists "users_principal_update_school_non_admin" on public.users;

create policy "users_admin_all"
on public.users for all
using (public.is_admin_or_service())
with check (public.is_admin_or_service());

create policy "users_principal_supervisor_read_school"
on public.users for select
using (
  public.app_role() in ('principal', 'supervisor')
  and school_id = public.app_school_id()
);

create policy "users_teacher_read_self"
on public.users for select
using (auth_id = auth.uid());

create policy "users_principal_update_school_non_admin"
on public.users for update
using (
  public.app_role() = 'principal'
  and school_id = public.app_school_id()
)
with check (
  public.app_role() = 'principal'
  and school_id = public.app_school_id()
  and role in ('principal', 'supervisor', 'teacher')
);

drop trigger if exists prevent_users_school_id_change on public.users;
create trigger prevent_users_school_id_change
before insert or update of school_id on public.users
for each row execute function public.prevent_school_id_change();

-- 3. classes
alter table public.classes enable row level security;
alter table public.classes force row level security;

drop policy if exists "classes_admin_all" on public.classes;
drop policy if exists "classes_principal_supervisor_school_all" on public.classes;
drop policy if exists "classes_teacher_read_own" on public.classes;

create policy "classes_admin_all"
on public.classes for all
using (public.is_admin_or_service())
with check (public.is_admin_or_service());

create policy "classes_principal_supervisor_school_all"
on public.classes for all
using (
  public.app_role() in ('principal', 'supervisor')
  and school_id = public.app_school_id()
)
with check (
  public.app_role() in ('principal', 'supervisor')
  and school_id = public.app_school_id()
);

create policy "classes_teacher_read_own"
on public.classes for select
using (
  public.app_role() = 'teacher'
  and school_id = public.app_school_id()
  and teacher_id = public.app_user_id()
);

drop trigger if exists prevent_classes_school_id_change on public.classes;
create trigger prevent_classes_school_id_change
before insert or update of school_id on public.classes
for each row execute function public.prevent_school_id_change();

-- 4. students
alter table public.students enable row level security;
alter table public.students force row level security;

drop policy if exists "students_admin_all" on public.students;
drop policy if exists "students_principal_supervisor_school_all" on public.students;
drop policy if exists "students_teacher_read_own_classes" on public.students;

create policy "students_admin_all"
on public.students for all
using (public.is_admin_or_service())
with check (public.is_admin_or_service());

create policy "students_principal_supervisor_school_all"
on public.students for all
using (
  public.app_role() in ('principal', 'supervisor')
  and school_id = public.app_school_id()
)
with check (
  public.app_role() in ('principal', 'supervisor')
  and school_id = public.app_school_id()
);

create policy "students_teacher_read_own_classes"
on public.students for select
using (
  public.app_role() = 'teacher'
  and school_id = public.app_school_id()
  and exists (
    select 1
    from public.classes c
    where c.id = students.class_id
      and c.teacher_id = public.app_user_id()
      and c.school_id = public.app_school_id()
  )
);

drop trigger if exists prevent_students_school_id_change on public.students;
create trigger prevent_students_school_id_change
before insert or update of school_id on public.students
for each row execute function public.prevent_school_id_change();

-- 5. weekly_questions
alter table public.weekly_questions enable row level security;
alter table public.weekly_questions force row level security;

drop policy if exists "weekly_questions_admin_all" on public.weekly_questions;
drop policy if exists "weekly_questions_principal_supervisor_school_all" on public.weekly_questions;
drop policy if exists "weekly_questions_teacher_read_school_or_global" on public.weekly_questions;

create policy "weekly_questions_admin_all"
on public.weekly_questions for all
using (public.is_admin_or_service())
with check (public.is_admin_or_service());

create policy "weekly_questions_principal_supervisor_school_all"
on public.weekly_questions for all
using (
  public.app_role() in ('principal', 'supervisor')
  and school_id = public.app_school_id()
)
with check (
  public.app_role() in ('principal', 'supervisor')
  and school_id = public.app_school_id()
);

create policy "weekly_questions_teacher_read_school_or_global"
on public.weekly_questions for select
using (
  public.app_role() = 'teacher'
  and (school_id = public.app_school_id() or school_id is null)
);

drop trigger if exists prevent_weekly_questions_school_id_change on public.weekly_questions;
create trigger prevent_weekly_questions_school_id_change
before insert or update of school_id on public.weekly_questions
for each row execute function public.prevent_school_id_change();

-- 6. assessments
alter table public.assessments enable row level security;
alter table public.assessments force row level security;

drop policy if exists "assessments_admin_all" on public.assessments;
drop policy if exists "assessments_principal_supervisor_school_all" on public.assessments;
drop policy if exists "assessments_teacher_read_own" on public.assessments;

create policy "assessments_admin_all"
on public.assessments for all
using (public.is_admin_or_service())
with check (public.is_admin_or_service());

create policy "assessments_principal_supervisor_school_all"
on public.assessments for all
using (
  public.app_role() in ('principal', 'supervisor')
  and school_id = public.app_school_id()
)
with check (
  public.app_role() in ('principal', 'supervisor')
  and school_id = public.app_school_id()
);

create policy "assessments_teacher_read_own"
on public.assessments for select
using (
  public.app_role() = 'teacher'
  and school_id = public.app_school_id()
  and teacher_id = public.app_user_id()
);

drop trigger if exists prevent_assessments_school_id_change on public.assessments;
create trigger prevent_assessments_school_id_change
before insert or update of school_id on public.assessments
for each row execute function public.prevent_school_id_change();

-- 7. results, scoped through assessments
alter table public.results enable row level security;
alter table public.results force row level security;

drop policy if exists "results_admin_all" on public.results;
drop policy if exists "results_principal_supervisor_school_all" on public.results;
drop policy if exists "results_teacher_read_own_assessments" on public.results;

create policy "results_admin_all"
on public.results for all
using (public.is_admin_or_service())
with check (public.is_admin_or_service());

create policy "results_principal_supervisor_school_all"
on public.results for all
using (
  public.app_role() in ('principal', 'supervisor')
  and exists (
    select 1
    from public.assessments a
    where a.id = results.assessment_id
      and a.school_id = public.app_school_id()
  )
)
with check (
  public.app_role() in ('principal', 'supervisor')
  and exists (
    select 1
    from public.assessments a
    where a.id = results.assessment_id
      and a.school_id = public.app_school_id()
  )
);

create policy "results_teacher_read_own_assessments"
on public.results for select
using (
  public.app_role() = 'teacher'
  and exists (
    select 1
    from public.assessments a
    where a.id = results.assessment_id
      and a.school_id = public.app_school_id()
      and a.teacher_id = public.app_user_id()
  )
);

-- 8. reports
alter table public.reports enable row level security;
alter table public.reports force row level security;

drop policy if exists "reports_admin_all" on public.reports;
drop policy if exists "reports_principal_supervisor_school_all" on public.reports;
drop policy if exists "reports_teacher_read_own" on public.reports;

create policy "reports_admin_all"
on public.reports for all
using (public.is_admin_or_service())
with check (public.is_admin_or_service());

create policy "reports_principal_supervisor_school_all"
on public.reports for all
using (
  public.app_role() in ('principal', 'supervisor')
  and school_id = public.app_school_id()
)
with check (
  public.app_role() in ('principal', 'supervisor')
  and school_id = public.app_school_id()
);

create policy "reports_teacher_read_own"
on public.reports for select
using (
  public.app_role() = 'teacher'
  and school_id = public.app_school_id()
  and teacher_id = public.app_user_id()
);

drop trigger if exists prevent_reports_school_id_change on public.reports;
create trigger prevent_reports_school_id_change
before insert or update of school_id on public.reports
for each row execute function public.prevent_school_id_change();

-- 9. subscriptions
alter table public.subscriptions enable row level security;
alter table public.subscriptions force row level security;

drop policy if exists "subscriptions_admin_all" on public.subscriptions;
drop policy if exists "subscriptions_principal_read_own_school" on public.subscriptions;

create policy "subscriptions_admin_all"
on public.subscriptions for all
using (public.is_admin_or_service())
with check (public.is_admin_or_service());

create policy "subscriptions_principal_read_own_school"
on public.subscriptions for select
using (
  public.app_role() = 'principal'
  and school_id = public.app_school_id()
);

drop trigger if exists prevent_subscriptions_school_id_change on public.subscriptions;
create trigger prevent_subscriptions_school_id_change
before insert or update of school_id on public.subscriptions
for each row execute function public.prevent_school_id_change();

-- 10. weekly_sets last. Contains answer_key and has no school_id.
alter table public.weekly_sets enable row level security;
alter table public.weekly_sets force row level security;

drop policy if exists "weekly_sets_admin_all" on public.weekly_sets;

create policy "weekly_sets_admin_all"
on public.weekly_sets for all
using (public.is_admin_or_service())
with check (public.is_admin_or_service());
