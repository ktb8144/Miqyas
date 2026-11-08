-- One row per Claude call: tokens and an estimated cost, per school and task, so the monthly
-- API credit can be followed from the admin panel instead of the Claude Console.
-- Written only by the server (lib/claude.ts) with the service role: RLS on, no policies.
-- school_id/user_id are kept as null when a school or user is deleted, so totals stay true.

create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  school_id uuid references public.schools(id) on delete set null,
  user_id uuid references public.users(id) on delete set null,
  task text not null,
  provider text not null default 'claude',
  model text not null,
  effort text,
  batch boolean not null default false,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cache_read_tokens integer not null default 0,
  cache_write_tokens integer not null default 0,
  cost_usd numeric(10, 4) not null default 0,
  duration_ms integer,
  status text not null check (status in ('ok', 'error')),
  error_kind text
);

create index if not exists ai_usage_created_at_idx on public.ai_usage (created_at desc);
create index if not exists ai_usage_school_idx on public.ai_usage (school_id, created_at desc);

alter table public.ai_usage enable row level security;

comment on table public.ai_usage is 'Claude API calls: tokens (output includes thinking) and estimated USD cost, per school and task.';
