-- Rows for the research export: answers from schools whose consent matches the given version,
-- without students a parent excluded. Returns internal ids; the export replaces them with random
-- per-export codes and drops small classes before anything leaves the server. Service role only.

create or replace function public.research_responses(p_version text)
returns table (
  response_id uuid,
  school_id uuid,
  school_kind text,
  school_stage text,
  school_gender text,
  class_id uuid,
  student_id uuid,
  grade integer,
  subject text,
  package_id uuid,
  assessment_code text,
  week_number integer,
  question_number integer,
  difficulty text,
  domain text,
  skill text,
  selected_option text,
  correct_option text,
  is_correct boolean,
  mark_status text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    q.id,
    s.id,
    s.kind,
    s.stage,
    s.gender,
    r.class_id,
    st.id,
    coalesce(c.grade, ap.grade, st.grade),
    coalesce(ap.subject, c.subject),
    ap.id,
    ap.assessment_code,
    ap.week_number,
    pq.question_number,
    pq.difficulty_level,
    coalesce(nd.domain_name, pq.domain_text),
    coalesce(ls.skill_name, pq.skill_text),
    q.selected_option,
    q.correct_option,
    q.is_correct,
    q.mark_status
  from public.student_question_results q
  join public.student_package_results r on r.id = q.student_package_result_id
  join public.students st on st.id = q.student_id
  join public.schools s on s.id = r.school_id
  left join public.classes c on c.id = r.class_id
  left join public.assessment_packages ap on ap.id = r.package_id
  left join public.package_questions pq on pq.id = q.package_question_id
  left join public.nafs_domains nd on nd.id = coalesce(q.nafs_domain_id, pq.nafs_domain_id)
  left join public.learning_skills ls on ls.id = coalesce(q.skill_id, pq.skill_id)
  where s.research_consent = true
    and s.research_consent_version = p_version
    and st.research_opt_out = false
    and st.school_id = s.id
  order by q.id;
$$;

revoke all on function public.research_responses(text) from public, anon, authenticated;
grant execute on function public.research_responses(text) to service_role;
