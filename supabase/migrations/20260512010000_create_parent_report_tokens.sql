create table if not exists public.parent_report_tokens (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  student_id uuid not null references public.students(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  class_id uuid references public.classes(id) on delete set null,
  created_by uuid references public.users(id) on delete set null,
  expires_at timestamptz not null,
  opened_at timestamptz,
  last_opened_at timestamptz,
  open_count integer not null default 0,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.parent_report_tokens
  add column if not exists opened_at timestamptz,
  add column if not exists last_opened_at timestamptz,
  add column if not exists open_count integer not null default 0;

create table if not exists public.parent_report_events (
  id uuid primary key default gen_random_uuid(),
  token_id uuid not null references public.parent_report_tokens(id) on delete cascade,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists parent_report_events_token_idx
on public.parent_report_events(token_id, created_at desc);

create index if not exists parent_report_tokens_student_idx
on public.parent_report_tokens(student_id, expires_at);

create index if not exists parent_report_tokens_school_idx
on public.parent_report_tokens(school_id);

alter table public.parent_report_tokens enable row level security;
alter table public.parent_report_tokens force row level security;
alter table public.parent_report_events enable row level security;
alter table public.parent_report_events force row level security;

drop policy if exists "parent_report_tokens_admin_all" on public.parent_report_tokens;
drop policy if exists "parent_report_tokens_staff_school_read" on public.parent_report_tokens;
drop policy if exists "parent_report_events_admin_all" on public.parent_report_events;
drop policy if exists "parent_report_events_staff_school_read" on public.parent_report_events;

create policy "parent_report_tokens_admin_all"
on public.parent_report_tokens for all
using (
  exists (
    select 1 from public.users u
    where u.auth_id = auth.uid()
      and u.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.users u
    where u.auth_id = auth.uid()
      and u.role = 'admin'
  )
);

create policy "parent_report_tokens_staff_school_read"
on public.parent_report_tokens for select
using (
  exists (
    select 1 from public.users u
    where u.auth_id = auth.uid()
      and u.role in ('principal', 'supervisor', 'teacher')
      and u.school_id = parent_report_tokens.school_id
  )
);

create policy "parent_report_events_admin_all"
on public.parent_report_events for all
using (
  exists (
    select 1 from public.users u
    where u.auth_id = auth.uid()
      and u.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.users u
    where u.auth_id = auth.uid()
      and u.role = 'admin'
  )
);

create policy "parent_report_events_staff_school_read"
on public.parent_report_events for select
using (
  exists (
    select 1
    from public.parent_report_tokens t
    join public.users u on u.school_id = t.school_id
    where t.id = parent_report_events.token_id
      and u.auth_id = auth.uid()
      and u.role in ('principal', 'supervisor', 'teacher')
  )
);

notify pgrst, 'reload schema';
