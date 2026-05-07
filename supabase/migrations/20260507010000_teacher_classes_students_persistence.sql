-- Persist teacher-created classes and students with scoped RLS.

alter table public.students
  add column if not exists student_number text,
  add column if not exists score integer not null default 0,
  add column if not exists total integer not null default 10;

drop policy if exists "classes_teacher_read_own" on public.classes;
drop policy if exists "classes_teacher_insert_own" on public.classes;
drop policy if exists "classes_teacher_update_own" on public.classes;

create policy "classes_teacher_read_own"
on public.classes for select
using (
  public.app_role() = 'teacher'
  and school_id = public.app_school_id()
  and teacher_id = public.app_user_id()
);

create policy "classes_teacher_insert_own"
on public.classes for insert
with check (
  public.app_role() = 'teacher'
  and school_id = public.app_school_id()
  and teacher_id = public.app_user_id()
);

create policy "classes_teacher_update_own"
on public.classes for update
using (
  public.app_role() = 'teacher'
  and school_id = public.app_school_id()
  and teacher_id = public.app_user_id()
)
with check (
  public.app_role() = 'teacher'
  and school_id = public.app_school_id()
  and teacher_id = public.app_user_id()
);

drop policy if exists "students_teacher_read_own_classes" on public.students;
drop policy if exists "students_teacher_insert_own_classes" on public.students;
drop policy if exists "students_teacher_update_own_classes" on public.students;

create policy "students_teacher_read_own_classes"
on public.students for select
using (
  public.app_role() = 'teacher'
  and school_id = public.app_school_id()
  and exists (
    select 1
    from public.classes c
    where c.id = students.class_id
      and c.teacher_id = public.app_user_id()
      and c.school_id = public.app_school_id()
  )
);

create policy "students_teacher_insert_own_classes"
on public.students for insert
with check (
  public.app_role() = 'teacher'
  and school_id = public.app_school_id()
  and exists (
    select 1
    from public.classes c
    where c.id = students.class_id
      and c.teacher_id = public.app_user_id()
      and c.school_id = public.app_school_id()
  )
);

create policy "students_teacher_update_own_classes"
on public.students for update
using (
  public.app_role() = 'teacher'
  and school_id = public.app_school_id()
  and exists (
    select 1
    from public.classes c
    where c.id = students.class_id
      and c.teacher_id = public.app_user_id()
      and c.school_id = public.app_school_id()
  )
)
with check (
  public.app_role() = 'teacher'
  and school_id = public.app_school_id()
  and exists (
    select 1
    from public.classes c
    where c.id = students.class_id
      and c.teacher_id = public.app_user_id()
      and c.school_id = public.app_school_id()
  )
);
