alter table public.assessment_packages
add column if not exists duration_minutes int,
add column if not exists package_type text not null default 'weekly';

do $$
begin
  alter table public.assessment_packages
  add constraint assessment_packages_duration_minutes_check
  check (duration_minutes is null or duration_minutes > 0);
exception
  when duplicate_object then null;
end $$;

alter table public.package_questions
drop constraint if exists package_questions_correct_option_check;

alter table public.package_questions
add constraint package_questions_correct_option_check
check (correct_option in ('أ', 'ب', 'ج', 'د', 'blank', 'unclear'));

notify pgrst, 'reload schema';
