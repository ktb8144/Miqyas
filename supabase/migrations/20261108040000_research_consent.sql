-- Optional research participation, kept separate from the service terms.
--   * A school (its principal, or an independent teacher for their own account) opts in, and can withdraw.
--   * A parent can exclude their child from research through the parent report link.
--   * Every research export is logged.
-- All changes go through the two functions below (server only), so state and history never drift apart.

-- ── School consent: current state ───────────────────────────────────────────
alter table public.schools
  add column if not exists research_consent boolean not null default false,
  add column if not exists research_consent_version text,
  add column if not exists research_consent_updated_at timestamptz;

comment on column public.schools.research_consent is 'School agreed to share de-identified data for research (optional, separate from the service terms).';
comment on column public.schools.research_consent_version is 'Version of the research information the school agreed to (lib/research.ts RESEARCH_CONSENT_VERSION).';

-- ── School consent: full history (who, when, which text, grant or withdraw) ─
create table if not exists public.research_consent_events (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  granted boolean not null,
  version text not null,
  source text not null check (source in ('signup', 'settings', 'admin')),
  created_at timestamptz not null default now()
);

create index if not exists research_consent_events_school_idx
  on public.research_consent_events (school_id, created_at desc);

alter table public.research_consent_events enable row level security;

-- ── Parent opt-out per student ──────────────────────────────────────────────
alter table public.students
  add column if not exists research_opt_out boolean not null default false,
  add column if not exists research_opt_out_at timestamptz;

comment on column public.students.research_opt_out is 'A parent excluded this student from research exports (set only through the parent report link).';

create table if not exists public.research_opt_out_events (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  school_id uuid references public.schools(id) on delete cascade,
  opted_out boolean not null,
  source text not null check (source in ('parent_report', 'admin')),
  created_at timestamptz not null default now()
);

create index if not exists research_opt_out_events_student_idx
  on public.research_opt_out_events (student_id, created_at desc);

alter table public.research_opt_out_events enable row level security;

-- Teachers and principals may update student rows directly (RLS), but never the parent's research choice.
create or replace function public.guard_student_research_opt_out()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon')
     and (new.research_opt_out is distinct from old.research_opt_out
          or new.research_opt_out_at is distinct from old.research_opt_out_at) then
    raise exception 'research_opt_out is set only by the parent report link';
  end if;
  return new;
end;
$$;

drop trigger if exists students_guard_research_opt_out on public.students;
create trigger students_guard_research_opt_out
  before update on public.students
  for each row execute function public.guard_student_research_opt_out();

-- ── Export log ──────────────────────────────────────────────────────────────
create table if not exists public.research_exports (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.users(id) on delete set null,
  consent_version text not null,
  schools_count integer not null default 0,
  students_count integer not null default 0,
  response_rows integer not null default 0,
  suppressed_classes integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.research_exports enable row level security;

-- ── The only ways to change consent / opt-out (server, service role) ────────
create or replace function public.set_research_consent(
  p_school uuid, p_user uuid, p_granted boolean, p_version text, p_source text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.schools
     set research_consent = p_granted,
         research_consent_version = p_version,
         research_consent_updated_at = now()
   where id = p_school;
  if not found then
    raise exception 'school not found';
  end if;
  insert into public.research_consent_events (school_id, user_id, granted, version, source)
  values (p_school, p_user, p_granted, p_version, p_source);
end;
$$;

create or replace function public.set_research_opt_out(
  p_student uuid, p_opted_out boolean, p_source text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school uuid;
begin
  update public.students
     set research_opt_out = p_opted_out,
         research_opt_out_at = now()
   where id = p_student
  returning school_id into v_school;
  if not found then
    raise exception 'student not found';
  end if;
  insert into public.research_opt_out_events (student_id, school_id, opted_out, source)
  values (p_student, v_school, p_opted_out, p_source);
end;
$$;

revoke all on function public.set_research_consent(uuid, uuid, boolean, text, text) from public, anon, authenticated;
revoke all on function public.set_research_opt_out(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.set_research_consent(uuid, uuid, boolean, text, text) to service_role;
grant execute on function public.set_research_opt_out(uuid, boolean, text) to service_role;
