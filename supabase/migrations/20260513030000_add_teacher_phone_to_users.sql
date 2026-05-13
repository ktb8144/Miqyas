alter table public.users
  add column if not exists phone text;

create index if not exists users_school_phone_idx
on public.users(school_id, phone)
where phone is not null;

notify pgrst, 'reload schema';
