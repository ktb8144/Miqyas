alter table public.package_questions
add column if not exists misconceptions_json jsonb;

create index if not exists package_questions_misconceptions_gin_idx
on public.package_questions using gin (misconceptions_json);

notify pgrst, 'reload schema';
