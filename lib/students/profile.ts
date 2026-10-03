import "server-only";
import { getAdminClient } from "@/lib/supabase-admin";
import { fetchAllRows } from "@/lib/db/paginate";
import { firstJoin, misconceptionForOption } from "@/lib/assessment/question-helpers";
import { gradeLabel, packageTypeLabel } from "@/lib/labels";
import { LEVEL_THRESHOLDS, MASTERY_THRESHOLD, getLevelFromPercentage } from "@/lib/levels";
import { percentOf, toPercent } from "@/lib/math";
import type { AppProfile } from "@/lib/auth";

/** A skill needs at least this many answers before we judge it. */
export const MIN_SKILL_EVIDENCE = 3;
const MAX_PRIORITIES = 3;

export type SkillStatus = "متقن" | "يحتاج تثبيت" | "أولوية متابعة" | "أدلة غير كافية";

export type StudentProfile = {
  student: {
    id: string;
    name: string;
    code: string | null;
    className: string;
    grade: number | null;
    gradeLabel: string;
    subject: string;
  };
  summary: {
    testsCount: number;
    averagePercentage: number | null;
    lastTest: { title: string; date: string | null; percentage: number; level: string } | null;
  };
  tests: {
    resultId: string;
    title: string;
    typeLabel: string;
    weekNumber: number | null;
    date: string | null;
    score: number;
    total: number;
    percentage: number;
    level: string;
    questions: {
      number: number | null;
      skill: string;
      selected: string | null;
      correct: string | null;
      isCorrect: boolean;
    }[];
  }[];
  skills: {
    skill: string;
    correct: number;
    total: number;
    mastery: number;
    testsCount: number;
    lastMeasuredAt: string | null;
    status: SkillStatus;
  }[];
  priorities: {
    skill: string;
    evidence: string;
    likelyCause: string | null;
    suggestedAction: string;
  }[];
};

type StudentRow = {
  id: string;
  name: string;
  student_code: string | null;
  school_id: string;
  class_id: string;
  classes: { name: string; grade: number | null; subject: string | null; teacher_id: string } | null;
};

type ResultRow = {
  id: string;
  score: number | string;
  total: number | string;
  percentage: number | string | null;
  level: string | null;
  scanned_at: string | null;
  created_at: string | null;
  assessment_packages: { title: string | null; package_type: string | null; week_number: number | null } | null;
};

type AnswerRow = {
  student_package_result_id: string;
  selected_option: string | null;
  correct_option: string | null;
  is_correct: boolean;
  package_questions: {
    question_number: number | null;
    skill_text: string | null;
    remediation_note: string | null;
    misconceptions_json: unknown;
    learning_skills: { skill_name: string | null } | null;
  } | null;
};

/**
 * Loads the student only if the viewer may see them:
 * - teacher: the student is in one of their own classes in their school
 * - principal / supervisor: the student is in their school
 * - admin: any student
 * Returns null otherwise, so callers answer 404 without revealing whether the student exists.
 */
export async function loadStudentForViewer(studentId: string, viewer: AppProfile) {
  const { data, error } = await getAdminClient()
    .from("students")
    .select("id, name, student_code, school_id, class_id, classes(name, grade, subject, teacher_id)")
    .eq("id", studentId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const student = { ...data, classes: firstJoin(data.classes) } as StudentRow;
  if (viewer.role === "admin") return student;
  if (!viewer.school_id || student.school_id !== viewer.school_id) return null;
  if (viewer.role === "teacher" && student.classes?.teacher_id !== viewer.id) return null;
  return student;
}

function skillStatus(mastery: number, total: number): SkillStatus {
  if (total < MIN_SKILL_EVIDENCE) return "أدلة غير كافية";
  if (mastery >= MASTERY_THRESHOLD) return "متقن";
  if (mastery >= LEVEL_THRESHOLDS.basic) return "يحتاج تثبيت";
  return "أولوية متابعة";
}

/**
 * Some packages store what a question *measures* in remediation_note ("يقيس قدرة الطالب على …").
 * That is not an action for the teacher, so it is not shown as one.
 */
function isRemediationAction(note: string | null | undefined) {
  const text = note?.trim();
  return Boolean(text) && !text!.startsWith("يقيس");
}

function testsPhrase(count: number) {
  if (count === 1) return "اختبار واحد";
  if (count === 2) return "اختبارين";
  if (count <= 10) return `${count} اختبارات`;
  return `${count} اختبارًا`;
}

export async function buildStudentProfile(student: StudentRow): Promise<StudentProfile> {
  const db = getAdminClient();

  const results = await fetchAllRows<ResultRow>((from, to) =>
    db
      .from("student_package_results")
      .select("id, score, total, percentage, level, scanned_at, created_at, assessment_packages(title, package_type, week_number)")
      .eq("student_id", student.id)
      .order("created_at", { ascending: false })
      .order("id")
      .range(from, to)
  );

  const answers = await fetchAllRows<AnswerRow>((from, to) =>
    db
      .from("student_question_results")
      .select(
        "student_package_result_id, selected_option, correct_option, is_correct, package_questions(question_number, skill_text, remediation_note, misconceptions_json, learning_skills(skill_name))"
      )
      .eq("student_id", student.id)
      .order("id")
      .range(from, to)
  );

  const resultDate = new Map(results.map((r) => [r.id, r.scanned_at ?? r.created_at]));
  const skillOf = (a: AnswerRow) => {
    const pq = firstJoin(a.package_questions);
    return firstJoin(pq?.learning_skills)?.skill_name?.trim() || pq?.skill_text?.trim() || "مهارة غير محددة";
  };

  // ── Tests, newest first, each with its questions ─────────────────────────
  const answersByResult = new Map<string, AnswerRow[]>();
  for (const a of answers) {
    answersByResult.set(a.student_package_result_id, [...(answersByResult.get(a.student_package_result_id) ?? []), a]);
  }

  const tests = results.map((r) => {
    const pkg = firstJoin(r.assessment_packages);
    const percentage = toPercent(r.percentage);
    return {
      resultId: r.id,
      title: pkg?.title?.trim() || "اختبار",
      typeLabel: packageTypeLabel(pkg?.package_type),
      weekNumber: pkg?.week_number ?? null,
      date: r.scanned_at ?? r.created_at,
      score: Number(r.score) || 0,
      total: Number(r.total) || 0,
      percentage,
      level: r.level || getLevelFromPercentage(percentage),
      questions: (answersByResult.get(r.id) ?? [])
        .map((a) => ({
          number: firstJoin(a.package_questions)?.question_number ?? null,
          skill: skillOf(a),
          selected: a.selected_option,
          correct: a.correct_option,
          isCorrect: a.is_correct,
        }))
        .sort((x, y) => (x.number ?? 0) - (y.number ?? 0)),
    };
  }).sort((x, y) => String(y.date ?? "").localeCompare(String(x.date ?? ""))); // newest first

  // ── Skills across all tests ──────────────────────────────────────────────
  type Bucket = {
    correct: number;
    total: number;
    results: Set<string>;
    lastMeasuredAt: string | null;
    wrongOptions: Map<string, { count: number; misconception: string | null }>;
    remediation: string | null;
  };
  const buckets = new Map<string, Bucket>();
  for (const a of answers) {
    const skill = skillOf(a);
    const b = buckets.get(skill) ?? {
      correct: 0,
      total: 0,
      results: new Set<string>(),
      lastMeasuredAt: null,
      wrongOptions: new Map(),
      remediation: null,
    };
    b.total += 1;
    if (a.is_correct) b.correct += 1;
    b.results.add(a.student_package_result_id);
    const date = resultDate.get(a.student_package_result_id) ?? null;
    if (date && (!b.lastMeasuredAt || date > b.lastMeasuredAt)) b.lastMeasuredAt = date;

    const pq = firstJoin(a.package_questions);
    if (!b.remediation && isRemediationAction(pq?.remediation_note)) b.remediation = pq!.remediation_note!.trim();
    if (!a.is_correct && a.selected_option && !["blank", "unclear"].includes(a.selected_option)) {
      const current = b.wrongOptions.get(a.selected_option) ?? {
        count: 0,
        misconception: misconceptionForOption(pq?.misconceptions_json, a.selected_option),
      };
      current.count += 1;
      b.wrongOptions.set(a.selected_option, current);
    }
    buckets.set(skill, b);
  }

  const skills = Array.from(buckets, ([skill, b]) => {
    const mastery = percentOf(b.correct, b.total);
    return {
      skill,
      correct: b.correct,
      total: b.total,
      mastery,
      testsCount: b.results.size,
      lastMeasuredAt: b.lastMeasuredAt,
      status: skillStatus(mastery, b.total),
    };
  }).sort((x, y) => x.mastery - y.mastery);

  // ── Support priorities: only skills with enough evidence and below mastery ─
  const priorities = skills
    .filter((s) => s.total >= MIN_SKILL_EVIDENCE && s.mastery < MASTERY_THRESHOLD)
    .slice(0, MAX_PRIORITIES)
    .map((s) => {
      const b = buckets.get(s.skill)!;
      const wrong = s.total - s.correct;
      const topWrong = Array.from(b.wrongOptions.values()).sort((x, y) => y.count - x.count)[0];
      return {
        skill: s.skill,
        evidence: `أخطأ في ${wrong} من ${s.total} أسئلة تناولت المهارة، في ${testsPhrase(s.testsCount)}.`,
        likelyCause:
          topWrong && topWrong.count >= 2 && topWrong.misconception
            ? `احتمال يحتاج تحققًا: ${topWrong.misconception}`
            : null,
        suggestedAction: b.remediation ?? "أعد قياس المهارة بسؤال أو سؤالين في الاختبار القادم بعد نشاط قصير.",
      };
    });

  const percentages = tests.map((t) => t.percentage);
  const last = tests[0];

  return {
    student: {
      id: student.id,
      name: student.name,
      code: student.student_code,
      className: student.classes?.name ?? "—",
      grade: student.classes?.grade ?? null,
      gradeLabel: gradeLabel(student.classes?.grade),
      subject: student.classes?.subject ?? "غير محدد",
    },
    summary: {
      testsCount: tests.length,
      averagePercentage: percentages.length
        ? Math.round(percentages.reduce((sum, v) => sum + v, 0) / percentages.length)
        : null,
      lastTest: last ? { title: last.title, date: last.date, percentage: last.percentage, level: last.level } : null,
    },
    tests,
    skills,
    priorities,
  };
}
