create index if not exists classes_school_teacher_idx
on public.classes(school_id, teacher_id);

create index if not exists students_class_id_idx
on public.students(class_id);

create index if not exists students_school_class_idx
on public.students(school_id, class_id);

create index if not exists assessments_school_teacher_idx
on public.assessments(school_id, teacher_id);

create index if not exists results_assessment_id_idx
on public.results(assessment_id);

create index if not exists reports_school_teacher_idx
on public.reports(school_id, teacher_id);

create index if not exists subscriptions_school_id_idx
on public.subscriptions(school_id);

create index if not exists weekly_questions_lookup_idx
on public.weekly_questions(school_id, subject, grade, week_number, status);
