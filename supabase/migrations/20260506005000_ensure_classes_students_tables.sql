-- Ensure teacher classes and students tables exist before RLS policies reference them.
-- Existing production tables are preserved; missing columns and constraints are added safely.

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  teacher_id uuid not null,
  name text not null,
  grade integer,
  subject text,
  created_at timestamptz not null default now()
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  class_id uuid not null,
  name text not null,
  student_number text,
  score integer not null default 0,
  total integer not null default 10,
  created_at timestamptz not null default now()
);

alter table public.classes
  add column if not exists school_id uuid,
  add column if not exists teacher_id uuid,
  add column if not exists name text,
  add column if not exists grade integer,
  add column if not exists subject text,
  add column if not exists created_at timestamptz not null default now();

alter table public.students
  add column if not exists school_id uuid,
  add column if not exists class_id uuid,
  add column if not exists name text,
  add column if not exists student_number text,
  add column if not exists score integer not null default 0,
  add column if not exists total integer not null default 10,
  add column if not exists created_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'students_class_id_fkey'
      and conrelid = 'public.students'::regclass
  ) then
    alter table public.students
      add constraint students_class_id_fkey
      foreign key (class_id)
      references public.classes(id)
      on delete cascade;
  end if;
end $$;

create index if not exists classes_teacher_id_idx on public.classes(teacher_id);
create index if not exists classes_school_id_idx on public.classes(school_id);
create index if not exists students_class_id_idx on public.students(class_id);
create index if not exists students_school_id_idx on public.students(school_id);
