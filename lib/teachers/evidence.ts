import "server-only";
import { getAdminClient } from "@/lib/supabase-admin";
import { chunk, fetchAllRows } from "@/lib/db/paginate";
import { firstJoin } from "@/lib/assessment/question-helpers";
import { gradeLabel, packageTypeLabel } from "@/lib/labels";
import { getLevelFromPercentage, type LevelName } from "@/lib/levels";
import { average, percentOf, toPercent } from "@/lib/math";
import type { AppProfile } from "@/lib/auth";

/** A class-level skill result needs at least this many answers to be reported. */
const MIN_CLASS_SKILL_ANSWERS = 5;
const WEAKEST_PER_TEST = 3;

export type EvidenceEntry = {
  assignmentId: string;
  date: string | null;
  title: string;
  typeLabel: string;
  weekNumber: number | null;
  className: string;
  gradeLabel: string;
  subject: string;
  studentsTested: number;
  classSize: number;
  average: number | null;
  distribution: Record<LevelName, number>;
  weakestSkills: { skill: string; mastery: number; answers: number }[];
};

export type TeacherEvidence = {
  teacher: { name: string; subject: string | null; schoolName: string };
  period: { from: string | null; to: string | null };
  totals: { testsApplied: number; classes: number; studentsTested: number; answersAnalyzed: number };
  entries: EvidenceEntry[];
  classTimelines: { className: string; points: { date: string | null; title: string; average: number | null }[] }[];
  repeatedSkills: {
    className: string;
    skill: string;
    first: { date: string | null; title: string; mastery: number; answers: number };
    latest: { date: string | null; title: string; mastery: number; answers: number };
    change: number;
  }[];
};

type ResultRow = {
  id: string;
  class_package_assignment_id: string;
  student_id: string;
  class_id: string;
  percentage: number | string | null;
  scanned_at: string | null;
  created_at: string | null;
};

type AssignmentRow = {
  id: string;
  class_id: string;
  assessment_packages: { title: string | null; package_type: string | null; week_number: number | null } | null;
  classes: { name: string | null; grade: number | null; subject: string | null } | null;
};

type AnswerRow = {
  student_package_result_id: string;
  is_correct: boolean;
  package_questions: { skill_text: string | null; learning_skills: { skill_name: string | null } | null } | null;
};

const emptyDistribution = (): Record<LevelName, number> => ({ متقدم: 0, متمكن: 0, أساسي: 0, "دون الأساسي": 0 });

/** Builds the teacher's evidence file from their own scanned tests, optionally within a date range. */
export async function buildTeacherEvidence(
  teacher: AppProfile,
  period: { from: string | null; to: string | null }
): Promise<TeacherEvidence> {
  const db = getAdminClient();
  const schoolId = teacher.school_id;
  if (!schoolId) throw new Error("حساب المعلم غير مرتبط بمدرسة");

  const schoolRes = await db.from("schools").select("name").eq("id", schoolId).maybeSingle();
  if (schoolRes.error) throw schoolRes.error;

  // ── The teacher's results in the period ──────────────────────────────────
  const results = await fetchAllRows<ResultRow>((from, to) => {
    let q = db
      .from("student_package_results")
      .select("id, class_package_assignment_id, student_id, class_id, percentage, scanned_at, created_at")
      .eq("teacher_id", teacher.id)
      .eq("school_id", schoolId);
    if (period.from) q = q.gte("created_at", period.from);
    if (period.to) q = q.lte("created_at", `${period.to}T23:59:59.999Z`);
    return q.order("id").range(from, to);
  });

  const assignmentIds = Array.from(new Set(results.map((r) => r.class_package_assignment_id)));
  const classIds = Array.from(new Set(results.map((r) => r.class_id)));

  const assignments: AssignmentRow[] = [];
  for (const ids of chunk(assignmentIds, 200)) {
    const { data, error } = await db
      .from("class_package_assignments")
      .select("id, class_id, assessment_packages(title, package_type, week_number), classes(name, grade, subject)")
      .in("id", ids)
      .eq("teacher_id", teacher.id);
    if (error) throw error;
    assignments.push(...((data ?? []) as unknown as AssignmentRow[]));
  }

  const classSizes = new Map<string, number>();
  for (const ids of chunk(classIds, 200)) {
    const rows = await fetchAllRows<{ class_id: string }>((from, to) =>
      db.from("students").select("class_id").in("class_id", ids).order("id").range(from, to)
    );
    for (const row of rows) classSizes.set(row.class_id, (classSizes.get(row.class_id) ?? 0) + 1);
  }

  const answers: AnswerRow[] = [];
  for (const ids of chunk(results.map((r) => r.id), 200)) {
    answers.push(
      ...(await fetchAllRows<AnswerRow>((from, to) =>
        db
          .from("student_question_results")
          .select("student_package_result_id, is_correct, package_questions(skill_text, learning_skills(skill_name))")
          .in("student_package_result_id", ids)
          .order("id")
          .range(from, to)
      ))
    );
  }

  // ── Group by applied test (assignment) ───────────────────────────────────
  const resultById = new Map(results.map((r) => [r.id, r]));
  const resultsByAssignment = new Map<string, ResultRow[]>();
  for (const r of results) {
    resultsByAssignment.set(r.class_package_assignment_id, [...(resultsByAssignment.get(r.class_package_assignment_id) ?? []), r]);
  }
  const skillsByAssignment = new Map<string, Map<string, { correct: number; total: number }>>();
  for (const a of answers) {
    const result = resultById.get(a.student_package_result_id);
    if (!result) continue;
    const pq = firstJoin(a.package_questions);
    const skill = firstJoin(pq?.learning_skills)?.skill_name?.trim() || pq?.skill_text?.trim();
    if (!skill) continue;
    const bySkill = skillsByAssignment.get(result.class_package_assignment_id) ?? new Map();
    const current = bySkill.get(skill) ?? { correct: 0, total: 0 };
    current.total += 1;
    if (a.is_correct) current.correct += 1;
    bySkill.set(skill, current);
    skillsByAssignment.set(result.class_package_assignment_id, bySkill);
  }

  const entries: EvidenceEntry[] = assignments
    .map((assignment) => {
      const rows = resultsByAssignment.get(assignment.id) ?? [];
      const pkg = firstJoin(assignment.assessment_packages);
      const cls = firstJoin(assignment.classes);
      const percentages = rows.map((r) => toPercent(r.percentage));
      const distribution = emptyDistribution();
      percentages.forEach((p) => (distribution[getLevelFromPercentage(p)] += 1));
      const dates = rows.map((r) => r.scanned_at ?? r.created_at).filter(Boolean).sort() as string[];
      const weakestSkills = Array.from(skillsByAssignment.get(assignment.id) ?? [], ([skill, t]) => ({
        skill,
        mastery: percentOf(t.correct, t.total),
        answers: t.total,
      }))
        .filter((s) => s.answers >= MIN_CLASS_SKILL_ANSWERS)
        .sort((a, b) => a.mastery - b.mastery)
        .slice(0, WEAKEST_PER_TEST);
      return {
        assignmentId: assignment.id,
        date: dates[dates.length - 1] ?? null,
        title: pkg?.title?.trim() || "اختبار",
        typeLabel: packageTypeLabel(pkg?.package_type),
        weekNumber: pkg?.week_number ?? null,
        className: cls?.name ?? "—",
        gradeLabel: gradeLabel(cls?.grade),
        subject: cls?.subject ?? "—",
        studentsTested: new Set(rows.map((r) => r.student_id)).size,
        classSize: classSizes.get(assignment.class_id) ?? 0,
        average: average(percentages),
        distribution,
        weakestSkills,
      };
    })
    .sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")));

  // ── Per-class timeline (different tests — shown as results, not "improvement") ─
  const classLabel = (e: EvidenceEntry) => `${e.gradeLabel} — ${e.className}`;
  const timelines = new Map<string, EvidenceEntry[]>();
  for (const e of entries) timelines.set(classLabel(e), [...(timelines.get(classLabel(e)) ?? []), e]);
  const classTimelines = Array.from(timelines, ([className, list]) => ({
    className,
    points: [...list]
      .sort((a, b) => String(a.date ?? "").localeCompare(String(b.date ?? "")))
      .map((e) => ({ date: e.date, title: e.title, average: e.average })),
  }));

  // ── Same skill measured again in the same class: the only fair "progress" ─
  const repeatedSkills: TeacherEvidence["repeatedSkills"] = [];
  for (const [className, list] of Array.from(timelines)) {
    const chronological = [...list].sort((a, b) => String(a.date ?? "").localeCompare(String(b.date ?? "")));
    const measurements = new Map<string, { date: string | null; title: string; mastery: number; answers: number }[]>();
    for (const e of chronological) {
      for (const [skill, t] of Array.from(skillsByAssignment.get(e.assignmentId) ?? new Map<string, { correct: number; total: number }>())) {
        if (t.total < MIN_CLASS_SKILL_ANSWERS) continue;
        measurements.set(skill, [
          ...(measurements.get(skill) ?? []),
          { date: e.date, title: e.title, mastery: percentOf(t.correct, t.total), answers: t.total },
        ]);
      }
    }
    for (const [skill, points] of Array.from(measurements)) {
      if (points.length < 2) continue;
      const first = points[0];
      const latest = points[points.length - 1];
      repeatedSkills.push({ className, skill, first, latest, change: latest.mastery - first.mastery });
    }
  }
  repeatedSkills.sort((a, b) => b.change - a.change);

  return {
    teacher: { name: teacher.name ?? "المعلم", subject: teacher.subject, schoolName: schoolRes.data?.name ?? "—" },
    period,
    totals: {
      testsApplied: entries.length,
      classes: timelines.size,
      studentsTested: new Set(results.map((r) => r.student_id)).size,
      answersAnalyzed: answers.length,
    },
    entries,
    classTimelines,
    repeatedSkills,
  };
}
