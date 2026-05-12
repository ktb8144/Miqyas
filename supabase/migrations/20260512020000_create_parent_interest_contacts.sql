create table if not exists public.parent_interest_contacts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.parent_report_events(id) on delete cascade,
  token_id uuid references public.parent_report_tokens(id) on delete cascade,
  whatsapp_phone text,
  email text,
  relation text,
  consent_text text not null,
  consent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists parent_interest_contacts_event_idx
on public.parent_interest_contacts(event_id);

create index if not exists parent_interest_contacts_token_idx
on public.parent_interest_contacts(token_id, created_at desc);

alter table public.parent_interest_contacts enable row level security;
alter table public.parent_interest_contacts force row level security;

drop policy if exists "parent_interest_contacts_admin_all" on public.parent_interest_contacts;

create policy "parent_interest_contacts_admin_all"
on public.parent_interest_contacts for all
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

notify pgrst, 'reload schema';
