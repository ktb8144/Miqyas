create table if not exists public.trial_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  school_name text not null,
  phone text not null,
  email text not null,
  message text,
  status text not null default 'new',
  created_at timestamptz not null default now(),
  constraint trial_requests_status_check
    check (status in ('new', 'contacted', 'closed'))
);

create index if not exists trial_requests_status_idx
  on public.trial_requests (status);

create index if not exists trial_requests_created_at_idx
  on public.trial_requests (created_at desc);
