# Research participation (record of processing)

Research use of Dala data is **optional and separate from the service**. This file records the
purposes, data and safeguards, and how the controls work. It is written so that it can be reused in the
ethics application and the PDPL record of processing activities (Article 30 asks for the research
purposes to be stated there).

## Purposes

- How student mastery of NAFS skills (reading, mathematics, science) develops week by week.
- Which misconceptions are most common, by grade, subject and skill.
- How weekly assessment results relate to the school's previous NAFS results.
- Improving the questions, reports and remediation plans the platform gives to schools.

## Who decides

| Level | Who | Where | Default |
|---|---|---|---|
| School | Principal (school accounts) or the teacher (independent teacher accounts) | Optional checkbox at sign-up; card on the dashboard | Not participating |
| Student | Parent | "استبعاد بيانات ابني من البحث" on the parent report page (shown only when the school participates) | Included if the school participates |

Using Dala never depends on taking part. Withdrawing is one click, the same effort as agreeing.

## Data

Used: answers per question (option, correct or not, how the bubble was read), skill/domain/difficulty,
grade, subject, assessment week, school stage and boys/girls, the school's previous NAFS results as entered.

Never exported: student names or numbers, teacher names, school name or city, phone, email, parent links,
answer-sheet photos (never stored), dates finer than the assessment week.

## Safeguards in the export

- Locked unless `RESEARCH_EXPORT_ENABLED=true` is set in Vercel. Set it only after the ethics committee
  and Ministry of Education approvals.
- Only schools whose consent matches the current `RESEARCH_CONSENT_VERSION` (`lib/research.ts`).
- Students excluded by a parent are left out (filtered in the `research_responses` database function).
- New random codes for every school, class and student in every export; no key is stored.
- Classes with fewer than 5 included students are dropped; summary cells and NAFS rows under 5 likewise.
- Every export is logged in `research_exports` (admin, time, counts). If the log fails, nothing is exported.

## Database

- `schools.research_consent`, `research_consent_version`, `research_consent_updated_at`: current state.
- `research_consent_events`: every grant or withdrawal (who, when, version, source).
- `students.research_opt_out`, `research_opt_out_at` and `research_opt_out_events`: parent choices.
  A trigger stops teachers and principals from changing the parent's choice from the app.
- Changes go only through `set_research_consent` and `set_research_opt_out` (service role).

## After ethics approval

1. Update `/research` (`app/research/page.tsx`) with the approved study details: researcher, university,
   approval number, contact for complaints. Use the approved explanatory statement wording.
2. Bump `RESEARCH_CONSENT_VERSION`. Schools that agreed earlier see "تأكيد المشاركة" and are excluded
   until they confirm.
3. Complete the cross-border transfer risk assessment if any personal data leaves the Kingdom (the export
   itself is de-identified; the service is hosted outside the Kingdom, see the privacy policy).
4. Set `RESEARCH_EXPORT_ENABLED=true` in Vercel and redeploy.
