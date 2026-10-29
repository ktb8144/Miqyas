-- A school's previous NAFS results, entered by the principal from the school report
-- (or imported from the Excel template). Used to build the situation report and the
-- improvement plan. Read and written only through /api/principal/nafs-baseline with the
-- service role, so RLS is on with no policies (deny by default for anon/authenticated).

create table if not exists public.nafs_baselines (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  year integer not null check (year between 2018 and 2100),
  grade integer not null check (grade in (3, 6)),
  subject text not null check (subject in ('رياضيات', 'قراءة', 'علوم')),
  overall_percent numeric(5, 2) check (overall_percent between 0 and 100),
  mastery_percent numeric(5, 2) check (mastery_percent between 0 and 100),
  tested_count integer check (tested_count >= 0),
  absent_count integer check (absent_count >= 0),
  domains jsonb not null default '[]'::jsonb check (jsonb_typeof(domains) = 'array'),
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, year, grade, subject)
);

alter table public.nafs_baselines enable row level security;
