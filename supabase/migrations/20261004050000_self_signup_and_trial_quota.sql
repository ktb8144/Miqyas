-- Self-signup, school join codes, trial scan quota, independent-teacher class limit.
-- Additive only: new nullable/defaulted columns, one new table, one trigger. No data removed.

alter table public.schools
  add column if not exists kind text not null default 'school',
  add column if not exists ministry_number text,
  add column if not exists gender text,
  add column if not exists join_code text,
  add column if not exists scan_quota integer;

do $$ begin
  alter table public.schools add constraint schools_kind_check check (kind in ('school', 'individual'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.schools add constraint schools_gender_check check (gender is null or gender in ('boys', 'girls'));
exception when duplicate_object then null; end $$;

create unique index if not exists schools_ministry_number_key on public.schools (ministry_number) where ministry_number is not null;
create unique index if not exists schools_join_code_key on public.schools (join_code) where join_code is not null;

-- Existing schools get a join code so their teachers can sign up with it.
update public.schools
set join_code = upper(substr(md5(id::text || clock_timestamp()::text), 1, 6))
where join_code is null and kind = 'school';

-- One row per paper sent to the AI reader: trial quota + real cost tracking.
create table if not exists public.scan_usage (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  class_package_assignment_id uuid,
  succeeded boolean not null default true,
  model text,
  input_tokens integer,
  output_tokens integer,
  thinking_tokens integer,
  created_at timestamptz not null default now()
);
create index if not exists scan_usage_school_created_idx on public.scan_usage (school_id, created_at);
-- Server (service role) only: RLS on, no policies.
alter table public.scan_usage enable row level security;

-- Independent teachers (teacher package) can have at most 4 classes.
create or replace function public.enforce_individual_class_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select kind from public.schools where id = new.school_id) = 'individual'
     and (select count(*) from public.classes where school_id = new.school_id) >= 4 then
    raise exception 'باقة المعلم تتيح 4 فصول كحد أقصى' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke execute on function public.enforce_individual_class_limit() from public, anon, authenticated;

create trigger classes_individual_limit
  before insert on public.classes
  for each row execute function public.enforce_individual_class_limit();
