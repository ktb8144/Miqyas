-- Allow science weekly plans for grades 4-6 without touching existing rows.

alter table public.weekly_plans
  drop constraint if exists weekly_plans_subject_check;

do $$
declare
  constraint_name text;
begin
  select c.conname
  into constraint_name
  from pg_constraint c
  where c.conrelid = 'public.weekly_plans'::regclass
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) like '%subject%'
  limit 1;

  if constraint_name is not null then
    execute format('alter table public.weekly_plans drop constraint %I', constraint_name);
  end if;
end;
$$;

alter table public.weekly_plans
  add constraint weekly_plans_subject_check
  check (subject in ('رياضيات', 'لغة عربية', 'علوم'));

notify pgrst, 'reload schema';
