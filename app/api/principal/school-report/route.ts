import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase-admin";
import { requireUserRole, authErrorResponse } from "@/lib/auth";
import { LEVEL_THRESHOLDS } from "@/lib/levels";
import { average } from "@/lib/math";
import { chunk, fetchAllRows } from "@/lib/db/paginate";
import type { ClassRow as DbClassRow, StudentPackageResultRow, StudentRow as DbStudentRow } from "@/lib/db/rows";

export const dynamic = "force-dynamic";

const AT_RISK_THRESHOLD = LEVEL_THRESHOLDS.basic;
/** Skill analysis looks at recent answers only, so the dashboard reflects the current situation. */
const SKILL_WINDOW_DAYS = 60;
/** A skill needs at least this many answers before it is ranked, to avoid noise from one question. */
const MIN_SKILL_ANSWERS = 5;

type StudentRow = Pick<DbStudentRow, "id" | "name" | "class_id">;

type ResultRow = Pick<StudentPackageResultRow, "id" | "student_id" | "percentage" | "created_at"> & {
  class_id: string;
  teacher_id: string;
};

type AnswerRow = {
  is_correct: boolean;
  package_questions: {
    skill_text: string | null;
    learning_skills: { skill_name: string | null } | null;
  } | null;
};

type ClassRow = Pick<DbClassRow, "id" | "name" | "grade" | "subject" | "teacher_id" | "school_id"> & {
  students: StudentRow[];
};

type WeeklyPlanRow = {
  id: string;
  week_number: number;
  start_date: string;
  end_date: string;
  start_hijri: string;
  end_hijri: string;
  grade: number;
  grade_label: string;
  subject: string;
  skill: string;
  difficulty_level: string;
};

function toNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

/** Groups result percentages by a key and returns the rounded average per key. */
function averageBy(results: ResultRow[], key: (row: ResultRow) => string) {
  const groups = new Map<string, number[]>();
  for (const row of results) {
    const pct = toNumber(row.percentage);
    if (pct === null) continue;
    const k = key(row);
    groups.set(k, [...(groups.get(k) ?? []), pct]);
  }
  return new Map(Array.from(groups, ([k, values]) => [k, average(values)] as const));
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizePlanSubject(subject?: string | null) {
  const value = (subject ?? "").trim();
  if (["رياضيات", "الرياضيات"].includes(value)) return "رياضيات";
  if (["لغة عربية", "اللغة العربية", "عربية", "لغتي", "قراءة"].includes(value)) return "لغة عربية";
  if (["علوم", "العلوم"].includes(value)) return "علوم";
  return null;
}

export async function GET(req: NextRequest) {
  const auth = await requireUserRole(req, ["admin", "principal"]);
  if (!auth.ok) return authErrorResponse(auth);

  try {
    const db = getAdminClient();
    const requestedSchoolId = new URL(req.url).searchParams.get("school_id");
    const schoolId = auth.profile.role === "admin" && requestedSchoolId
      ? requestedSchoolId
      : auth.profile.school_id;

    if (!schoolId) {
      return NextResponse.json(
        { success: false, error: "حسابك غير مرتبط بمدرسة" },
        { status: 403 }
      );
    }

    const [schoolRes, teachersRes, classesRes] = await Promise.all([
      db.from("schools").select("id, name, city, region, active, trial").eq("id", schoolId).single(),
      db.from("users").select("id, name, email, phone, subject, status, created_at").eq("school_id", schoolId).eq("role", "teacher").order("created_at", { ascending: false }),
      db.from("classes").select("id, name, grade, subject, teacher_id, school_id, students(id, name, class_id)").eq("school_id", schoolId).order("created_at", { ascending: false }),
    ]);

    if (schoolRes.error) throw schoolRes.error;
    if (teachersRes.error) throw teachersRes.error;
    if (classesRes.error) throw classesRes.error;

    const school = schoolRes.data;
    const teachers = teachersRes.data ?? [];
    const classes = (classesRes.data ?? []) as ClassRow[];
    const students = classes.flatMap((classRow) =>
      (Array.isArray(classRow.students) ? classRow.students : []).map((student) => ({
        ...student,
        className: classRow.name,
        subject: classRow.subject ?? "غير محدد",
        teacherId: classRow.teacher_id,
      }))
    );

    // ── Results: every scanned package sitting in this school ────────────────
    const results = await fetchAllRows<ResultRow>((from, to) =>
      db
        .from("student_package_results")
        .select("id, student_id, class_id, teacher_id, percentage, created_at")
        .eq("school_id", schoolId)
        .order("id")
        .range(from, to)
    );

    const studentAverages = averageBy(results, (row) => row.student_id);
    const classAverages = averageBy(results, (row) => row.class_id);
    const teacherAverages = averageBy(results, (row) => row.teacher_id);

    const scoredStudents = students
      .map((student) => ({ ...student, percentage: studentAverages.get(student.id) ?? null }))
      .filter((student): student is typeof student & { percentage: number } => student.percentage !== null);

    const performanceAverage = average(scoredStudents.map((student) => student.percentage));
    const atRiskStudents = scoredStudents
      .filter((student) => student.percentage < AT_RISK_THRESHOLD)
      .sort((a, b) => a.percentage - b.percentage)
      .slice(0, 10)
      .map((student) => ({
        id: student.id,
        name: student.name,
        className: student.className,
        percentage: student.percentage,
      }));

    const classesWithResults = new Set(results.map((row) => row.class_id)).size;
    const implementationRate = classes.length
      ? Math.round((classesWithResults / classes.length) * 100)
      : null;

    // ── Weakest skills: real per-question answers from the recent window ─────
    const since = new Date(Date.now() - SKILL_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const recentResultIds = results.filter((row) => row.created_at && row.created_at >= since).map((row) => row.id);
    const answers: AnswerRow[] = [];
    for (const ids of chunk(recentResultIds, 200)) {
      answers.push(
        ...(await fetchAllRows<AnswerRow>((from, to) =>
          db
            .from("student_question_results")
            .select("is_correct, package_questions(skill_text, learning_skills(skill_name))")
            .in("student_package_result_id", ids)
            .order("id")
            .range(from, to)
        ))
      );
    }
    const skillTotals = new Map<string, { correct: number; total: number }>();
    for (const answer of answers) {
      const skill =
        answer.package_questions?.learning_skills?.skill_name?.trim()
        || answer.package_questions?.skill_text?.trim();
      if (!skill) continue;
      const current = skillTotals.get(skill) ?? { correct: 0, total: 0 };
      current.total += 1;
      if (answer.is_correct) current.correct += 1;
      skillTotals.set(skill, current);
    }
    const weakSkills = Array.from(skillTotals, ([skill, t]) => ({
      skill,
      average: Math.round((t.correct / t.total) * 100),
      count: t.total,
    }))
      .filter((item) => item.count >= MIN_SKILL_ANSWERS)
      .sort((a, b) => a.average - b.average)
      .slice(0, 5);

    const teacherRows = teachers.map((teacher) => {
      const teacherClasses = classes.filter((classRow) => classRow.teacher_id === teacher.id);
      const teacherStudents = students.filter((student) => student.teacherId === teacher.id);
      const teacherAverage = teacherAverages.get(teacher.id) ?? null;
      return {
        id: teacher.id,
        name: teacher.name,
        email: teacher.email,
        phone: teacher.phone ?? null,
        subject: teacher.subject ?? "غير محدد",
        status: teacher.status ?? "active",
        classNames: teacherClasses.map((classRow) => classRow.name),
        classesCount: teacherClasses.length,
        studentsCount: teacherStudents.length,
        average: teacherAverage,
        active: teacherClasses.length > 0 || teacherAverage !== null,
      };
    });

    const activeTeachers = teacherRows.filter((teacher) => teacher.active).length;
    const teacherEngagement = teachers.length
      ? Math.round((activeTeachers / teachers.length) * 100)
      : null;

    const today = new Date().toISOString().slice(0, 10);
    const currentPlansRes = await db
      .from("weekly_plans")
      .select("id, week_number, start_date, end_date, start_hijri, end_hijri, grade, grade_label, subject, skill, difficulty_level")
      .eq("status", "active")
      .lte("start_date", today)
      .gte("end_date", today)
      .order("grade", { ascending: true })
      .order("subject", { ascending: true });

    let weeklyPlanSource: "current_week" | "upcoming" | "none" = "none";
    let weeklyPlans = (currentPlansRes.error ? [] : currentPlansRes.data ?? []) as WeeklyPlanRow[];

    if (weeklyPlans.length) {
      weeklyPlanSource = "current_week";
    } else {
      const upcomingPlansRes = await db
        .from("weekly_plans")
        .select("id, week_number, start_date, end_date, start_hijri, end_hijri, grade, grade_label, subject, skill, difficulty_level")
        .eq("status", "active")
        .gt("start_date", today)
        .order("start_date", { ascending: true })
        .order("grade", { ascending: true })
        .order("subject", { ascending: true })
        .limit(8);
      weeklyPlans = (upcomingPlansRes.error ? [] : upcomingPlansRes.data ?? []) as WeeklyPlanRow[];
      weeklyPlanSource = weeklyPlans.length ? "upcoming" : "none";
    }

    const weeklyPlanKeys = new Set(weeklyPlans.map((plan) => `${plan.grade}:${plan.subject}`));
    const targetClasses = classes.filter((classRow) =>
      classRow.grade !== null
      && [3, 4, 5, 6].includes(classRow.grade)
      && normalizePlanSubject(classRow.subject) !== null
      && !(classRow.grade === 3 && normalizePlanSubject(classRow.subject) === "علوم")
    );
    const matchingClassesCount = targetClasses.filter((classRow) =>
      weeklyPlanKeys.has(`${classRow.grade}:${normalizePlanSubject(classRow.subject)}`)
    ).length;
    const unsupportedClassesCount = classes.filter((classRow) =>
      classRow.grade !== null
      && (
        ![3, 4, 5, 6].includes(classRow.grade)
        || normalizePlanSubject(classRow.subject) === null
        || (classRow.grade === 3 && normalizePlanSubject(classRow.subject) === "علوم")
      )
    ).length;
    const weeklyPlanSummary = {
      source: weeklyPlanSource,
      weekNumber: weeklyPlans[0]?.week_number ?? null,
      startDate: weeklyPlans[0]?.start_date ?? null,
      endDate: weeklyPlans[0]?.end_date ?? null,
      startHijri: weeklyPlans[0]?.start_hijri ?? null,
      endHijri: weeklyPlans[0]?.end_hijri ?? null,
      targetGrades: [3, 4, 5, 6],
      targetSubjects: ["رياضيات", "لغة عربية", "علوم للصفوف 4-6"],
      activePlansCount: weeklyPlans.length,
      matchingClassesCount,
      classesWithoutPlans: Math.max(0, targetClasses.length - matchingClassesCount),
      unsupportedClassesCount,
      plans: weeklyPlans.map((plan) => ({
        id: plan.id,
        weekNumber: plan.week_number,
        grade: plan.grade,
        gradeLabel: plan.grade_label,
        subject: plan.subject,
        skill: plan.skill,
        difficultyLevel: plan.difficulty_level,
      })),
    };

    const improvement = {
      value: null as number | null,
      label: "لا توجد بيانات كافية لحساب التحسن",
      note: "نحسب التحسن عند إعادة قياس المهارات نفسها، لأن مقارنة اختبارات تقيس مهارات مختلفة لا تعطي نتيجة صحيحة.",
    };

    const readinessInputs = [performanceAverage, implementationRate, teacherEngagement].filter(
      (value): value is number => value !== null
    );
    const readinessIndex = readinessInputs.length
      ? clamp(
          ((performanceAverage ?? 0) * 0.5)
          + ((implementationRate ?? 0) * 0.3)
          + ((teacherEngagement ?? 0) * 0.2)
        )
      : null;

    return NextResponse.json({
      success: true,
      data: {
        school,
        period: {
          label: "الفترة الحالية",
          generatedAt: new Date().toISOString(),
        },
        kpis: {
          teachersCount: teachers.length,
          classesCount: classes.length,
          studentsCount: students.length,
          performanceAverage,
          atRiskCount: atRiskStudents.length,
          implementationRate,
        },
        improvement,
        readinessIndex: {
          value: readinessIndex,
          label: readinessIndex === null ? "لا توجد بيانات كافية" : "مؤشر مبدئي",
          formula: "50% متوسط الأداء + 30% نسبة التنفيذ + 20% تفاعل المعلمين",
        },
        weakSkills,
        atRiskStudents,
        teacherEngagement: {
          activeTeachers,
          totalTeachers: teachers.length,
          rate: teacherEngagement,
        },
        weeklyPlanSummary,
        teachers: teacherRows,
        classes: classes.map((classRow) => {
          const classStudents = students.filter((student) => student.class_id === classRow.id);
          return {
            id: classRow.id,
            name: classRow.name,
            grade: classRow.grade,
            subject: classRow.subject ?? "غير محدد",
            studentsCount: classStudents.length,
            average: classAverages.get(classRow.id) ?? null,
          };
        }),
        alerts: [
          ...(atRiskStudents.length ? [{ type: "risk", title: "طلاب يحتاجون تدخل", detail: `${atRiskStudents.length} طالب دون ${AT_RISK_THRESHOLD}%` }] : []),
          ...(weeklyPlanSummary.classesWithoutPlans ? [{ type: "plan", title: "فصول بلا خطة مطابقة", detail: `${weeklyPlanSummary.classesWithoutPlans} فصل يحتاج ضبط الصف أو المادة` }] : []),
          ...(weeklyPlanSummary.unsupportedClassesCount ? [{ type: "plan", title: "مواد أو صفوف خارج المرحلة الأولى", detail: `${weeklyPlanSummary.unsupportedClassesCount} فصل خارج نطاق الصفوف 3-6 أو مواد دالة الحالية` }] : []),
          ...(!students.length ? [{ type: "empty", title: "لا توجد بيانات طلاب", detail: "ابدأ بإضافة الفصول والطلاب من لوحة المعلم." }] : []),
          ...(!scoredStudents.length ? [{ type: "empty", title: "لا توجد نتائج بعد", detail: "ستظهر مؤشرات الأداء بعد إدخال نتائج الطلاب." }] : []),
        ],
        notes: [
          performanceAverage === null ? "لا توجد درجات كافية لحساب متوسط الأداء." : null,
          weakSkills.length ? `المهارات الأضعف محسوبة من إجابات الطلاب في آخر ${SKILL_WINDOW_DAYS} يومًا.` : null,
          improvement.value === null ? improvement.note : null,
        ].filter(Boolean),
      },
    });
  } catch (err) {
    console.error("principal school report failed", err);
    return NextResponse.json(
      { success: false, error: "تعذر تحميل تقرير المدرسة" },
      { status: 500 }
    );
  }
}
