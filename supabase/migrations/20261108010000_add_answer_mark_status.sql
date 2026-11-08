-- How each answer was shaded on the paper, saved with the answer for reports and research.
-- Dala's shading rules (Nov 2026): two shaded bubbles or none → wrong, no teacher review;
-- a half-shaded bubble counts when it is the only one marked. These rows keep the evidence:
--   mark_status  clear | partial | stray | multiple | blank | unclear | manual (teacher changed it)
--   mark_fill    share of each bubble that was shaded, in option order (e.g. [0.62, 0.04, 0.03, 0.05])
-- Both are null for answers saved before this change or typed by hand.

alter table public.student_question_results
  add column if not exists mark_status text
    check (mark_status in ('clear', 'partial', 'stray', 'multiple', 'blank', 'unclear', 'manual')),
  add column if not exists mark_fill jsonb;

comment on column public.student_question_results.mark_status is
  'How the answer was shaded: clear, partial (counted, only mark), stray (shaded + light extra mark), multiple (wrong), blank (wrong), unclear (photo not measurable), manual (set by the teacher).';
comment on column public.student_question_results.mark_fill is
  'Share (0-1) of each bubble that was shaded, in option order, as read on the device.';
