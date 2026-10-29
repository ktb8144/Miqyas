import "server-only";
import { getAdminClient } from "@/lib/supabase-admin";
import { chunk, fetchAllRows } from "@/lib/db/paginate";
import { firstJoin } from "@/lib/assessment/question-helpers";
import { toPercent } from "@/lib/math";
import { buildClassDiagnosis, REPORT_TEST_WINDOW, type ClassDiagnosis, type DiagnosisInput } from "./class-diagnosis";

type ResultRow = { id: string; student_id: string; package_id: string; score: number | string | null; total: number | string | null; percentage: number | string | null; scanned_at: string | null; created_at: string };
type AnswerRow = { id: string; student_package_result_id: string; student_id: string; package_question_id: string | null; selected_option: string | null; is_correct: boolean };
type QuestionRow = {
  id: string;
  package_id: string;
  question_number: number | null;
  question_text: string | null;
  options_json: unknown;
  correct_option: string | null;
  skill_text: string | null;
  domain_text: string | null;
  misconceptions_json: unknown;
  remediation_note: string | null;
  learning_skills?: { skill_name?: string | null } | Array<{ skill_name?: string | null }> | null;
  nafs_domains?: { domain_name?: string | null } | Array<{ domain_name?: string | null }> | null;
};

export class ReportAccessError extends Error {}

function optionsOf(value: unknown): Record<string, string> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => typeof v === "string" || typeof v === "number");
  return entries.length ? Object.fromEntries(entries.map(([k, v]) => [k, String(v)])) : null;
}

/**
 * Loads one class's saved results and returns its diagnosis. The caller must already have
 * checked the user; a `teacherId` limits the class to that teacher.
 */
export async function loadClassDiagnosis({ classId, schoolId, teacherId }: { classId: string; schoolId: string; teacherId: string | null }): Promise<ClassDiagnosis> {
  const db = getAdminClient();

  let classQuery = db.from("classes").select("id, name, grade, subject, teacher_id, school_id").eq("id", classId).eq("school_id", schoolId);
  if (teacherId) classQuery = classQuery.eq("teacher_id", teacherId);
  const { data: classRow, error: classError } = await classQuery.maybeSingle();
  if (classError) throw classError;
  if (!classRow) throw new ReportAccessError("لم يتم العثور على الفصل في حسابك");

  const [studentsRes, results] = await Promise.all([
    db.from("students").select("id, name").eq("class_id", classId).eq("school_id", schoolId).order("name"),
    fetchAllRows<ResultRow>((from, to) => db
      .from("student_package_results")
      .select("id, student_id, package_id, score, total, percentage, scanned_at, created_at")
      .eq("class_id", classId)
      .eq("school_id", schoolId)
      .order("id")
      .range(from, to)),
  ]);
  if (studentsRes.error) throw studentsRes.error;
  const students = (studentsRes.data ?? []) as Array<{ id: string; name: string }>;

  // One result per student per test: the latest scan wins.
  const latestByStudentTest = new Map<string, ResultRow>();
  results.forEach((r) => {
    const key = `${r.student_id}::${r.package_id}`;
    const current = latestByStudentTest.get(key);
    const time = r.scanned_at ?? r.created_at;
    if (!current || time > (current.scanned_at ?? current.created_at)) latestByStudentTest.set(key, r);
  });
  const uniqueResults = Array.from(latestByStudentTest.values());

  const packageIds = Array.from(new Set(uniqueResults.map((r) => r.package_id)));
  const packages: Array<{ id: string; title: string | null; week_number: number | null; start_date: string | null }> = [];
  for (const ids of chunk(packageIds, 100)) {
    const { data, error } = await db.from("assessment_packages").select("id, title, week_number, start_date").in("id", ids);
    if (error) throw error;
    packages.push(...((data ?? []) as typeof packages));
  }

  // Only the most recent tests are analysed, so only their answers are loaded.
  const firstScan = new Map<string, string>();
  uniqueResults.forEach((r) => {
    const time = r.scanned_at ?? r.created_at;
    const current = firstScan.get(r.package_id);
    if (!current || time < current) firstScan.set(r.package_id, time);
  });
  const windowPackages = packages
    .map((p) => ({ ...p, time: Date.parse(p.start_date ?? firstScan.get(p.id) ?? "") || 0 }))
    .sort((a, b) => a.time - b.time)
    .slice(-REPORT_TEST_WINDOW);
  const windowIds = new Set(windowPackages.map((p) => p.id));
  const windowResults = uniqueResults.filter((r) => windowIds.has(r.package_id));

  const answers: AnswerRow[] = [];
  for (const ids of chunk(windowResults.map((r) => r.id), 150)) {
    answers.push(...await fetchAllRows<AnswerRow>((from, to) => db
      .from("student_question_results")
      .select("id, student_package_result_id, student_id, package_question_id, selected_option, is_correct")
      .in("student_package_result_id", ids)
      .order("id")
      .range(from, to)));
  }

  const questions: QuestionRow[] = [];
  for (const ids of chunk(Array.from(windowIds), 50)) {
    questions.push(...await fetchAllRows<QuestionRow>((from, to) => db
      .from("package_questions")
      .select("id, package_id, question_number, question_text, options_json, correct_option, skill_text, domain_text, misconceptions_json, remediation_note, learning_skills(skill_name), nafs_domains(domain_name)")
      .in("package_id", ids)
      .order("id")
      .range(from, to)));
  }

  const input: DiagnosisInput = {
    className: classRow.name,
    grade: classRow.grade ?? null,
    subject: classRow.subject ?? null,
    students,
    tests: windowPackages.map((p) => ({ packageId: p.id, title: p.title?.trim() || "اختبار دالة", week: p.week_number, date: p.start_date })),
    results: windowResults.map((r) => ({
      id: r.id,
      studentId: r.student_id,
      packageId: r.package_id,
      score: Number(r.score) || 0,
      total: Number(r.total) || 0,
      percentage: toPercent(r.percentage),
      scannedAt: r.scanned_at ?? r.created_at,
    })),
    answers: answers.map((a) => ({
      resultId: a.student_package_result_id,
      studentId: a.student_id,
      questionId: a.package_question_id,
      selected: a.selected_option,
      isCorrect: Boolean(a.is_correct),
    })),
    questions: questions.map((q) => ({
      id: q.id,
      packageId: q.package_id,
      number: Number(q.question_number) || 0,
      text: q.question_text,
      options: optionsOf(q.options_json),
      correct: q.correct_option,
      skill: firstJoin(q.learning_skills)?.skill_name?.trim() || q.skill_text?.trim() || null,
      domain: firstJoin(q.nafs_domains)?.domain_name?.trim() || q.domain_text?.trim() || null,
      misconceptions: q.misconceptions_json,
      remediation: q.remediation_note,
    })),
  };

  return buildClassDiagnosis(input);
}
