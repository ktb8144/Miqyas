alter table public.students
add column if not exists student_code text;

with numbered as (
  select
    id,
    row_number() over (
      partition by class_id
      order by created_at nulls last, name, id
    )::text as generated_code
  from public.students
  where student_code is null
)
update public.students s
set student_code = numbered.generated_code
from numbered
where s.id = numbered.id
  and s.student_code is null;

create unique index if not exists students_class_student_code_unique_idx
on public.students(class_id, student_code)
where student_code is not null;

notify pgrst, 'reload schema';
