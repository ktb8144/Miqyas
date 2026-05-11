-- Miqyas V0.2 package-based NAFS foundation.
-- This migration does not require official school NAFS uploads and does not remove V0.1 weekly plans/questions.

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

create table if not exists public.nafs_domains (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  grade int not null,
  domain_code text,
  domain_name text not null,
  description text,
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  created_at timestamptz not null default now()
);

create table if not exists public.learning_skills (
  id uuid primary key default gen_random_uuid(),
  nafs_domain_id uuid references public.nafs_domains(id) on delete set null,
  subject text not null,
  grade int not null,
  skill_code text,
  skill_name text not null,
  skill_description text,
  difficulty_level text not null default 'medium' check (difficulty_level in ('easy', 'medium', 'hard', 'nafs_simulation')),
  nafs_weight text not null default 'medium' check (nafs_weight in ('low', 'medium', 'high')),
  prerequisite_skill_id uuid references public.learning_skills(id) on delete set null,
  remediation_summary text,
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  created_at timestamptz not null default now()
);

create table if not exists public.assessment_packages (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  subject text not null,
  grade int not null,
  week_number int,
  start_date date,
  end_date date,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  student_pdf_url text,
  teacher_pdf_url text,
  answer_sheet_pdf_url text,
  answer_key_file_url text,
  created_by uuid references public.users(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.package_questions (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.assessment_packages(id) on delete cascade,
  question_number int not null check (question_number > 0),
  correct_option text not null check (correct_option in ('أ', 'ب', 'ج', 'د')),
  nafs_domain_id uuid references public.nafs_domains(id) on delete set null,
  skill_id uuid references public.learning_skills(id) on delete set null,
  difficulty_level text not null default 'medium' check (difficulty_level in ('easy', 'medium', 'hard', 'nafs_simulation')),
  points numeric not null default 1 check (points > 0),
  question_text text,
  created_at timestamptz not null default now(),
  unique(package_id, question_number)
);

create table if not exists public.school_package_assignments (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.assessment_packages(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  status text not null default 'available' check (status in ('available', 'active', 'completed', 'hidden')),
  assigned_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(package_id, school_id)
);

create table if not exists public.class_package_assignments (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.assessment_packages(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  teacher_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'assigned' check (status in ('assigned', 'printed', 'in_progress', 'scanned', 'completed')),
  printed_at timestamptz,
  scanned_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.student_package_results (
  id uuid primary key default gen_random_uuid(),
  class_package_assignment_id uuid not null references public.class_package_assignments(id) on delete cascade,
  package_id uuid not null references public.assessment_packages(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  teacher_id uuid not null references public.users(id) on delete cascade,
  score numeric not null default 0,
  total numeric not null default 0,
  percentage numeric,
  level text,
  scanned_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.student_question_results (
  id uuid primary key default gen_random_uuid(),
  student_package_result_id uuid not null references public.student_package_results(id) on delete cascade,
  package_question_id uuid references public.package_questions(id) on delete set null,
  package_id uuid references public.assessment_packages(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  selected_option text,
  correct_option text,
  is_correct boolean not null default false,
  nafs_domain_id uuid references public.nafs_domains(id) on delete set null,
  skill_id uuid references public.learning_skills(id) on delete set null,
  error_type text,
  created_at timestamptz not null default now()
);

create table if not exists public.improvement_plans (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  package_id uuid references public.assessment_packages(id) on delete set null,
  nafs_domain_id uuid references public.nafs_domains(id) on delete set null,
  skill_id uuid references public.learning_skills(id) on delete set null,
  field_name text,
  component text,
  process_to_improve text,
  need_description text,
  improvement_actions text,
  improvement_methods text,
  duration text,
  responsible_party text,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  status text not null default 'draft' check (status in ('draft', 'active', 'completed', 'archived')),
  created_at timestamptz not null default now()
);

create table if not exists public.teacher_training_tracking (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  teacher_id uuid not null references public.users(id) on delete cascade,
  subject text,
  students_count int not null default 0,
  training_sessions_count int not null default 0,
  simulation_questions_count int not null default 0,
  assessments_count int not null default 0,
  implementation_rate numeric,
  notes text,
  created_at timestamptz not null default now()
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
        and (q.skill_id is null or q.nafs_domain_id is null)
    ) then
      raise exception 'Published packages cannot contain questions without skill_id and nafs_domain_id';
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

  if package_status = 'published' and (new.skill_id is null or new.nafs_domain_id is null) then
    raise exception 'Questions in a published package must have skill_id and nafs_domain_id';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_assessment_package_publish on public.assessment_packages;
create trigger validate_assessment_package_publish
before insert or update of status on public.assessment_packages
for each row execute function public.validate_package_publish_ready();

drop trigger if exists validate_package_question_mapping on public.package_questions;
create trigger validate_package_question_mapping
before insert or update of skill_id, nafs_domain_id, package_id on public.package_questions
for each row execute function public.validate_package_question_mapping();

create unique index if not exists nafs_domains_grade_subject_code_idx
on public.nafs_domains(grade, subject, domain_code);

create unique index if not exists learning_skills_domain_code_idx
on public.learning_skills(nafs_domain_id, skill_code);

create index if not exists learning_skills_grade_subject_idx
on public.learning_skills(grade, subject, status);

create index if not exists assessment_packages_lookup_idx
on public.assessment_packages(grade, subject, week_number, status);

create index if not exists package_questions_package_idx
on public.package_questions(package_id, question_number);

create index if not exists school_package_assignments_school_idx
on public.school_package_assignments(school_id, status);

create index if not exists class_package_assignments_school_class_idx
on public.class_package_assignments(school_id, class_id, teacher_id, status);

create index if not exists student_package_results_assignment_idx
on public.student_package_results(class_package_assignment_id);

create index if not exists student_package_results_school_class_idx
on public.student_package_results(school_id, class_id);

create index if not exists student_question_results_package_idx
on public.student_question_results(package_id);

create index if not exists student_question_results_skill_idx
on public.student_question_results(skill_id);

create index if not exists improvement_plans_school_status_idx
on public.improvement_plans(school_id, status);

create index if not exists teacher_training_tracking_school_teacher_idx
on public.teacher_training_tracking(school_id, teacher_id);

alter table public.nafs_domains enable row level security;
alter table public.nafs_domains force row level security;
alter table public.learning_skills enable row level security;
alter table public.learning_skills force row level security;
alter table public.assessment_packages enable row level security;
alter table public.assessment_packages force row level security;
alter table public.package_questions enable row level security;
alter table public.package_questions force row level security;
alter table public.school_package_assignments enable row level security;
alter table public.school_package_assignments force row level security;
alter table public.class_package_assignments enable row level security;
alter table public.class_package_assignments force row level security;
alter table public.student_package_results enable row level security;
alter table public.student_package_results force row level security;
alter table public.student_question_results enable row level security;
alter table public.student_question_results force row level security;
alter table public.improvement_plans enable row level security;
alter table public.improvement_plans force row level security;
alter table public.teacher_training_tracking enable row level security;
alter table public.teacher_training_tracking force row level security;

drop policy if exists "nafs_domains_admin_all" on public.nafs_domains;
drop policy if exists "nafs_domains_staff_read_active" on public.nafs_domains;
create policy "nafs_domains_admin_all" on public.nafs_domains for all
using (public.is_admin_or_service()) with check (public.is_admin_or_service());
create policy "nafs_domains_staff_read_active" on public.nafs_domains for select
using (status = 'active' and public.app_role() in ('principal', 'supervisor', 'teacher'));

drop policy if exists "learning_skills_admin_all" on public.learning_skills;
drop policy if exists "learning_skills_staff_read_active" on public.learning_skills;
create policy "learning_skills_admin_all" on public.learning_skills for all
using (public.is_admin_or_service()) with check (public.is_admin_or_service());
create policy "learning_skills_staff_read_active" on public.learning_skills for select
using (status = 'active' and public.app_role() in ('principal', 'supervisor', 'teacher'));

drop policy if exists "assessment_packages_admin_all" on public.assessment_packages;
drop policy if exists "assessment_packages_school_staff_read_assigned_published" on public.assessment_packages;
create policy "assessment_packages_admin_all" on public.assessment_packages for all
using (public.is_admin_or_service()) with check (public.is_admin_or_service());
create policy "assessment_packages_school_staff_read_assigned_published" on public.assessment_packages for select
using (
  status = 'published'
  and public.app_role() in ('principal', 'supervisor', 'teacher')
  and exists (
    select 1
    from public.school_package_assignments spa
    where spa.package_id = assessment_packages.id
      and spa.school_id = public.app_school_id()
      and spa.status in ('available', 'active', 'completed')
  )
);

drop policy if exists "package_questions_admin_all" on public.package_questions;
create policy "package_questions_admin_all" on public.package_questions for all
using (public.is_admin_or_service()) with check (public.is_admin_or_service());

drop policy if exists "school_package_assignments_admin_all" on public.school_package_assignments;
drop policy if exists "school_package_assignments_principal_supervisor_school_all" on public.school_package_assignments;
drop policy if exists "school_package_assignments_teacher_read_school" on public.school_package_assignments;
create policy "school_package_assignments_admin_all" on public.school_package_assignments for all
using (public.is_admin_or_service()) with check (public.is_admin_or_service());
create policy "school_package_assignments_principal_supervisor_school_all" on public.school_package_assignments for all
using (public.app_role() in ('principal', 'supervisor') and school_id = public.app_school_id())
with check (public.app_role() in ('principal', 'supervisor') and school_id = public.app_school_id());
create policy "school_package_assignments_teacher_read_school" on public.school_package_assignments for select
using (public.app_role() = 'teacher' and school_id = public.app_school_id() and status in ('available', 'active', 'completed'));

drop policy if exists "class_package_assignments_admin_all" on public.class_package_assignments;
drop policy if exists "class_package_assignments_principal_supervisor_school_all" on public.class_package_assignments;
drop policy if exists "class_package_assignments_teacher_own_all" on public.class_package_assignments;
create policy "class_package_assignments_admin_all" on public.class_package_assignments for all
using (public.is_admin_or_service()) with check (public.is_admin_or_service());
create policy "class_package_assignments_principal_supervisor_school_all" on public.class_package_assignments for all
using (public.app_role() in ('principal', 'supervisor') and school_id = public.app_school_id())
with check (public.app_role() in ('principal', 'supervisor') and school_id = public.app_school_id());
create policy "class_package_assignments_teacher_own_all" on public.class_package_assignments for all
using (
  public.app_role() = 'teacher'
  and school_id = public.app_school_id()
  and teacher_id = public.app_user_id()
)
with check (
  public.app_role() = 'teacher'
  and school_id = public.app_school_id()
  and teacher_id = public.app_user_id()
  and exists (
    select 1
    from public.classes c
    where c.id = class_package_assignments.class_id
      and c.school_id = public.app_school_id()
      and c.teacher_id = public.app_user_id()
  )
);

drop policy if exists "student_package_results_admin_all" on public.student_package_results;
drop policy if exists "student_package_results_principal_supervisor_school_all" on public.student_package_results;
drop policy if exists "student_package_results_teacher_own_all" on public.student_package_results;
create policy "student_package_results_admin_all" on public.student_package_results for all
using (public.is_admin_or_service()) with check (public.is_admin_or_service());
create policy "student_package_results_principal_supervisor_school_all" on public.student_package_results for all
using (public.app_role() in ('principal', 'supervisor') and school_id = public.app_school_id())
with check (public.app_role() in ('principal', 'supervisor') and school_id = public.app_school_id());
create policy "student_package_results_teacher_own_all" on public.student_package_results for all
using (
  public.app_role() = 'teacher'
  and school_id = public.app_school_id()
  and teacher_id = public.app_user_id()
)
with check (
  public.app_role() = 'teacher'
  and school_id = public.app_school_id()
  and teacher_id = public.app_user_id()
  and exists (
    select 1
    from public.classes c
    where c.id = student_package_results.class_id
      and c.school_id = public.app_school_id()
      and c.teacher_id = public.app_user_id()
  )
);

drop policy if exists "student_question_results_admin_all" on public.student_question_results;
drop policy if exists "student_question_results_principal_supervisor_school_all" on public.student_question_results;
drop policy if exists "student_question_results_teacher_own_all" on public.student_question_results;
create policy "student_question_results_admin_all" on public.student_question_results for all
using (public.is_admin_or_service()) with check (public.is_admin_or_service());
create policy "student_question_results_principal_supervisor_school_all" on public.student_question_results for all
using (
  public.app_role() in ('principal', 'supervisor')
  and exists (
    select 1
    from public.student_package_results r
    where r.id = student_question_results.student_package_result_id
      and r.school_id = public.app_school_id()
  )
)
with check (
  public.app_role() in ('principal', 'supervisor')
  and exists (
    select 1
    from public.student_package_results r
    where r.id = student_question_results.student_package_result_id
      and r.school_id = public.app_school_id()
  )
);
create policy "student_question_results_teacher_own_all" on public.student_question_results for all
using (
  public.app_role() = 'teacher'
  and exists (
    select 1
    from public.student_package_results r
    where r.id = student_question_results.student_package_result_id
      and r.school_id = public.app_school_id()
      and r.teacher_id = public.app_user_id()
  )
)
with check (
  public.app_role() = 'teacher'
  and exists (
    select 1
    from public.student_package_results r
    where r.id = student_question_results.student_package_result_id
      and r.school_id = public.app_school_id()
      and r.teacher_id = public.app_user_id()
  )
);

drop policy if exists "improvement_plans_admin_all" on public.improvement_plans;
drop policy if exists "improvement_plans_principal_supervisor_school_all" on public.improvement_plans;
create policy "improvement_plans_admin_all" on public.improvement_plans for all
using (public.is_admin_or_service()) with check (public.is_admin_or_service());
create policy "improvement_plans_principal_supervisor_school_all" on public.improvement_plans for all
using (public.app_role() in ('principal', 'supervisor') and school_id = public.app_school_id())
with check (public.app_role() in ('principal', 'supervisor') and school_id = public.app_school_id());

drop policy if exists "teacher_training_tracking_admin_all" on public.teacher_training_tracking;
drop policy if exists "teacher_training_tracking_principal_supervisor_school_all" on public.teacher_training_tracking;
drop policy if exists "teacher_training_tracking_teacher_read_own" on public.teacher_training_tracking;
create policy "teacher_training_tracking_admin_all" on public.teacher_training_tracking for all
using (public.is_admin_or_service()) with check (public.is_admin_or_service());
create policy "teacher_training_tracking_principal_supervisor_school_all" on public.teacher_training_tracking for all
using (public.app_role() in ('principal', 'supervisor') and school_id = public.app_school_id())
with check (public.app_role() in ('principal', 'supervisor') and school_id = public.app_school_id());
create policy "teacher_training_tracking_teacher_read_own" on public.teacher_training_tracking for select
using (public.app_role() = 'teacher' and school_id = public.app_school_id() and teacher_id = public.app_user_id());

drop trigger if exists prevent_school_package_assignments_school_id_change on public.school_package_assignments;
create trigger prevent_school_package_assignments_school_id_change
before insert or update of school_id on public.school_package_assignments
for each row execute function public.prevent_school_id_change();

drop trigger if exists prevent_class_package_assignments_school_id_change on public.class_package_assignments;
create trigger prevent_class_package_assignments_school_id_change
before insert or update of school_id on public.class_package_assignments
for each row execute function public.prevent_school_id_change();

drop trigger if exists prevent_student_package_results_school_id_change on public.student_package_results;
create trigger prevent_student_package_results_school_id_change
before insert or update of school_id on public.student_package_results
for each row execute function public.prevent_school_id_change();

drop trigger if exists prevent_improvement_plans_school_id_change on public.improvement_plans;
create trigger prevent_improvement_plans_school_id_change
before insert or update of school_id on public.improvement_plans
for each row execute function public.prevent_school_id_change();

drop trigger if exists prevent_teacher_training_tracking_school_id_change on public.teacher_training_tracking;
create trigger prevent_teacher_training_tracking_school_id_change
before insert or update of school_id on public.teacher_training_tracking
for each row execute function public.prevent_school_id_change();

notify pgrst, 'reload schema';
