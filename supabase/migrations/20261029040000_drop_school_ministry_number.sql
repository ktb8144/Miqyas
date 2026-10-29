-- Dala no longer asks for or stores a school's ministry number.
-- Checked on 2026-10-29: no school has a value in this column.
-- Apply AFTER the code that stopped writing it is live (signup inserted it before).
drop index if exists public.schools_ministry_number_key;
alter table public.schools drop column if exists ministry_number;
