-- Every test assigned to a class gets its own short code, printed as a QR on that class's sheets
-- (dalaedu.com/R/<code>). The database issues it on insert, so codes never have to be made by hand,
-- whatever the number of schools, stages, classes, subjects and tests.
--
-- Format: 7 characters from ABCDEFGHJKMNPQRSTUVWXYZ23456789 (no 0/O or 1/I/L), so 31^7 ≈ 27.5 billion codes.
-- Random rather than sequential, so one class's code says nothing about another's.

alter table public.class_package_assignments
  add column if not exists sheet_code text;

create or replace function public.dala_new_sheet_code()
returns text
language plpgsql
volatile
security definer            -- must see every school's codes to stay unique (RLS would hide them)
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  positions constant int[] := array[0, 1, 2, 3, 4, 5, 10];  -- random bytes of a v4 UUID (6 and 8 carry version bits)
  bytes bytea;
  code text;
  p int;
begin
  loop
    bytes := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
    code := '';
    foreach p in array positions loop
      code := code || substr(alphabet, 1 + (get_byte(bytes, p) % 31), 1);
    end loop;
    exit when not exists (select 1 from public.class_package_assignments where sheet_code = code);
  end loop;
  return code;
end;
$$;

create or replace function public.set_class_sheet_code()
returns trigger
language plpgsql
security definer            -- calls dala_new_sheet_code, which no client role may execute directly
set search_path = public
as $$
begin
  if new.sheet_code is null then
    new.sheet_code := public.dala_new_sheet_code();
  end if;
  return new;
end;
$$;

drop trigger if exists class_package_assignments_sheet_code on public.class_package_assignments;
create trigger class_package_assignments_sheet_code
  before insert on public.class_package_assignments
  for each row execute function public.set_class_sheet_code();

-- Existing assignments get theirs now.
update public.class_package_assignments
set sheet_code = public.dala_new_sheet_code()
where sheet_code is null;

alter table public.class_package_assignments
  alter column sheet_code set not null;

alter table public.class_package_assignments
  drop constraint if exists class_package_assignments_sheet_code_format;
alter table public.class_package_assignments
  add constraint class_package_assignments_sheet_code_format
  check (sheet_code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{7}$');

create unique index if not exists class_package_assignments_sheet_code_key
  on public.class_package_assignments (sheet_code);

-- Trigger/internal helpers only: no public /rest/v1/rpc endpoints (same rule as 20261003065506).
revoke execute on function public.dala_new_sheet_code() from anon, authenticated, public;
revoke execute on function public.set_class_sheet_code() from anon, authenticated, public;
