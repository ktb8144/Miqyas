-- Weekly Miqyas assessment plan for grades 3-6.

create table if not exists public.weekly_plans (
  id uuid primary key default gen_random_uuid(),
  academic_year text not null,
  week_number integer not null check (week_number > 0),
  term text nullable,
  start_date date not null,
  end_date date not null,
  start_hijri text not null,
  end_hijri text not null,
  grade integer not null check (grade in (3, 4, 5, 6)),
  grade_label text not null,
  subject text not null check (subject in ('رياضيات', 'لغة عربية', 'علوم')),
  domain text nullable,
  skill text not null,
  skill_code text nullable,
  learning_goal text nullable,
  assessment_title text not null,
  question_count integer not null default 10 check (question_count > 0),
  difficulty_level text not null default 'easy'
    check (difficulty_level in ('easy', 'medium', 'hard', 'nafs_simulation')),
  nafs_alignment text nullable,
  source_reference text nullable,
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  notes text nullable,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.weekly_plans
  add column if not exists academic_year text,
  add column if not exists week_number integer,
  add column if not exists term text,
  add column if not exists start_date date,
  add column if not exists end_date date,
  add column if not exists start_hijri text,
  add column if not exists end_hijri text,
  add column if not exists grade integer,
  add column if not exists grade_label text,
  add column if not exists subject text,
  add column if not exists domain text,
  add column if not exists skill text,
  add column if not exists skill_code text,
  add column if not exists learning_goal text,
  add column if not exists assessment_title text,
  add column if not exists question_count integer default 10,
  add column if not exists difficulty_level text default 'easy',
  add column if not exists nafs_alignment text,
  add column if not exists source_reference text,
  add column if not exists status text default 'active',
  add column if not exists notes text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create unique index if not exists weekly_plans_unique_week_grade_subject_idx
on public.weekly_plans(academic_year, week_number, grade, subject);

create index if not exists weekly_plans_academic_week_idx
on public.weekly_plans(academic_year, week_number);

create index if not exists weekly_plans_grade_subject_idx
on public.weekly_plans(grade, subject);

create index if not exists weekly_plans_date_range_idx
on public.weekly_plans(start_date, end_date);

create index if not exists weekly_plans_status_idx
on public.weekly_plans(status);

alter table public.weekly_plans enable row level security;
alter table public.weekly_plans force row level security;

drop policy if exists "weekly_plans_admin_all" on public.weekly_plans;
drop policy if exists "weekly_plans_principal_read_active" on public.weekly_plans;
drop policy if exists "weekly_plans_teacher_read_active" on public.weekly_plans;

create policy "weekly_plans_admin_all"
on public.weekly_plans for all
using (exists (select 1 from public.users u where u.auth_id = auth.uid() and u.role = 'admin'))
with check (exists (select 1 from public.users u where u.auth_id = auth.uid() and u.role = 'admin'));

create policy "weekly_plans_principal_read_active"
on public.weekly_plans for select
using (
  status = 'active'
  and exists (
    select 1 from public.users u
    where u.auth_id = auth.uid()
      and u.role in ('principal', 'supervisor')
  )
);

create policy "weekly_plans_teacher_read_active"
on public.weekly_plans for select
using (
  status = 'active'
  and exists (
    select 1 from public.users u
    where u.auth_id = auth.uid()
      and u.role = 'teacher'
  )
);

create or replace function public.set_weekly_plans_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists weekly_plans_set_updated_at on public.weekly_plans;
create trigger weekly_plans_set_updated_at
before update on public.weekly_plans
for each row
execute function public.set_weekly_plans_updated_at();

notify pgrst, 'reload schema';
