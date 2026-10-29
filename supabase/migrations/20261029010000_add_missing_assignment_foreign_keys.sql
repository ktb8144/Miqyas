-- The repo's package migration (20260511010000) declares these foreign keys, but the live
-- database was built by hand and never got them. Without them PostgREST cannot embed
-- `classes(...)` from class_package_assignments, so the teacher's «النتائج» view and the
-- evidence file fail. Checked on 2026-10-29: no orphan rows in any of these columns.

alter table public.class_package_assignments
  add constraint class_package_assignments_class_id_fkey
    foreign key (class_id) references public.classes(id) on delete cascade,
  add constraint class_package_assignments_school_id_fkey
    foreign key (school_id) references public.schools(id) on delete cascade,
  add constraint class_package_assignments_teacher_id_fkey
    foreign key (teacher_id) references public.users(id) on delete cascade;

alter table public.student_package_results
  add constraint student_package_results_student_id_fkey
    foreign key (student_id) references public.students(id) on delete cascade,
  add constraint student_package_results_class_id_fkey
    foreign key (class_id) references public.classes(id) on delete cascade,
  add constraint student_package_results_school_id_fkey
    foreign key (school_id) references public.schools(id) on delete cascade;

alter table public.student_question_results
  add constraint student_question_results_student_id_fkey
    foreign key (student_id) references public.students(id) on delete cascade;

alter table public.school_package_assignments
  add constraint school_package_assignments_school_id_fkey
    foreign key (school_id) references public.schools(id) on delete cascade;
