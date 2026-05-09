-- Harden public.users for production user invitations without breaking existing data.

alter table public.users
  add column if not exists auth_id uuid,
  add column if not exists school_id uuid,
  add column if not exists name text,
  add column if not exists email text,
  add column if not exists role text,
  add column if not exists subject text,
  add column if not exists status text not null default 'active',
  add column if not exists created_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'users_role_check'
      and conrelid = 'public.users'::regclass
  ) then
    alter table public.users
      add constraint users_role_check
      check (role in ('admin', 'principal', 'supervisor', 'teacher'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'users_auth_id_fkey'
      and conrelid = 'public.users'::regclass
  ) then
    alter table public.users
      add constraint users_auth_id_fkey
      foreign key (auth_id)
      references auth.users(id)
      on delete set null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'users_school_id_fkey'
      and conrelid = 'public.users'::regclass
  ) then
    alter table public.users
      add constraint users_school_id_fkey
      foreign key (school_id)
      references public.schools(id)
      on delete set null;
  end if;
end $$;

create unique index if not exists users_email_unique_idx
on public.users(lower(email))
where email is not null;

create index if not exists users_school_role_idx
on public.users(school_id, role);

create index if not exists users_auth_id_idx
on public.users(auth_id);
