# Class report

The «توليد تقرير الفصل» button in the teacher dashboard builds a report from the class's saved
test results (`student_package_results` + `student_question_results`).

## Two layers

1. **Diagnosis (no AI)** — `lib/reports/class-diagnosis.ts`. Pure and tested. Looks at the class's
   last 8 tests and computes:
   - test averages and level counts;
   - mastery per skill, and how many students got less than two thirds of that skill right;
   - each skill's earlier vs latest mastery when it was measured in more than one test (this is the
     fair progress measure, since different tests measure different skills);
   - the most-chosen wrong answer per skill, and any misconception recorded for it;
   - the three weakest skills below 70% ("focus"), with their questions and how many students chose
     each option;
   - the students to group for each focus skill (shown to the teacher only);
   - **questions whose answer key looks wrong**: 20% or fewer students matched the key, and 60% or
     more of the students agreed on one other option.

   Every number in the report comes from here.

2. **Narrative (AI, with a rules fallback)** — `lib/reports/class-report-ai.ts`. Gemini gets the
   diagnosis as anonymous aggregates and writes:
   - a summary and strengths;
   - priorities, with the likely misconception inferred from the values of the wrong options
     students chose;
   - next-lesson actions and a check.

   The reply is validated item by item, and priorities about skills that aren't in the data are
   dropped. If the AI is off, fails, or replies badly, `rulesNarrative` writes the same sections
   from fixed rules.

## Privacy

`reportPayload()` is a whitelist. It contains grade, subject, counts, skill names, question text and
options, and how many students chose each option. Student names, ids, the teacher, the class name
and the school never reach the model.

## Skill names

Questions link a skill either by id (`learning_skills`) or only by text (`package_questions.skill_text`).
Every reader must fall back from one to the other: the per-test diagnosis, the principal's test
summary and the parent report do this now.
