-- The deep NAFS analysis written by Claude from a school's previous NAFS results.
-- One row per school and set of results (input_hash): the analysis is generated once, in the
-- Claude Message Batches API (status pending → ready/failed), and reused until the results
-- change. Read and written only through /api/principal/nafs-analysis with the service role,
-- so RLS is on with no policies (deny by default for anon/authenticated).

create table if not exists public.nafs_analyses (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  input_hash text not null,
  status text not null default 'pending' check (status in ('pending', 'ready', 'failed')),
  batch_id text,
  model text,
  effort text,
  analysis jsonb,
  usage jsonb,
  error text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, input_hash)
);

alter table public.nafs_analyses enable row level security;
