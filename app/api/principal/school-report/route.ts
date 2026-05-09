import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, requireUserRole } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const AT_RISK_THRESHOLD = 50;

type StudentRow = {
  id: string;
  name: string;
  class_id: string;
  score: number | null;
  total: number | null;
};

type ClassRow = {
  id: string;
  name: string;
  grade: number | null;
  subject: string | null;
  teacher_id: string;
  school_id: string;
  students?: StudentRow[];
};

function pct(score: number | null | undefined, total: number | null | undefined) {
  if (!score || !total || total <= 0) return null;
  return Math.round((score / total) * 100);
}

function avg(values: number[]) {
  if (!values.length) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export async function GET(req: NextRequest) {
  const auth = await requireUserRole(req, ["admin", "principal"]);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

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

    const [schoolRes, teachersRes, classesRes, assessmentsRes] = await Promise.all([
      db.from("schools").select("id, name, city, region, active, trial").eq("id", schoolId).single(),
      db.from("users").select("id, name, email, subject, status, created_at").eq("school_id", schoolId).eq("role", "teacher").order("created_at", { ascending: false }),
      db.from("classes").select("id, name, grade, subject, teacher_id, school_id, students(id, name, class_id, score, total)").eq("school_id", schoolId).order("created_at", { ascending: false }),
      db.from("assessments").select("id, teacher_id, school_id, grade, subject, skill, status, created_at").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(50),
    ]);

    if (schoolRes.error) throw schoolRes.error;
    if (teachersRes.error) throw teachersRes.error;
    if (classesRes.error) throw classesRes.error;

    const school = schoolRes.data;
    const teachers = teachersRes.data ?? [];
    const classes = (classesRes.data ?? []) as ClassRow[];
    const assessments = assessmentsRes.error ? [] : assessmentsRes.data ?? [];
    const students = classes.flatMap((classRow) =>
      (Array.isArray(classRow.students) ? classRow.students : []).map((student) => ({
        ...student,
        className: classRow.name,
        subject: classRow.subject ?? "غير محدد",
        teacherId: classRow.teacher_id,
      }))
    );

    const scoredStudents = students
      .map((student) => ({ ...student, percentage: pct(student.score, student.total) }))
      .filter((student): student is typeof student & { percentage: number } => student.percentage !== null);

    const performanceAverage = avg(scoredStudents.map((student) => student.percentage));
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

    const classesWithResults = new Set(scoredStudents.map((student) => student.class_id)).size;
    const implementationRate = classes.length
      ? Math.round((classesWithResults / classes.length) * 100)
      : null;

    const subjectScores = new Map<string, number[]>();
    scoredStudents.forEach((student) => {
      const subject = student.subject || "غير محدد";
      subjectScores.set(subject, [...(subjectScores.get(subject) ?? []), student.percentage]);
    });
    const weakSkills = Array.from(subjectScores.entries())
      .map(([skill, values]) => ({ skill, average: avg(values) ?? 0, count: values.length }))
      .sort((a, b) => a.average - b.average)
      .slice(0, 5);

    const teacherRows = teachers.map((teacher) => {
      const teacherClasses = classes.filter((classRow) => classRow.teacher_id === teacher.id);
      const teacherStudents = students.filter((student) => student.teacherId === teacher.id);
      const teacherScores = teacherStudents
        .map((student) => pct(student.score, student.total))
        .filter((value): value is number => value !== null);
      return {
        id: teacher.id,
        name: teacher.name,
        email: teacher.email,
        subject: teacher.subject ?? "غير محدد",
        status: teacher.status ?? "active",
        classesCount: teacherClasses.length,
        studentsCount: teacherStudents.length,
        average: avg(teacherScores),
        active: teacherClasses.length > 0 || teacherScores.length > 0,
      };
    });

    const activeTeachers = teacherRows.filter((teacher) => teacher.active).length;
    const teacherEngagement = teachers.length
      ? Math.round((activeTeachers / teachers.length) * 100)
      : null;

    const improvement = {
      value: null as number | null,
      label: "لا توجد بيانات كافية لحساب التحسن",
      note: "يحتاج مقياس إلى نتائج أسبوعين أو أكثر لحساب التحسن الحقيقي.",
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
          assessmentsCount: assessments.length,
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
        teachers: teacherRows,
        classes: classes.map((classRow) => {
          const classStudents = students.filter((student) => student.class_id === classRow.id);
          const classScores = classStudents
            .map((student) => pct(student.score, student.total))
            .filter((value): value is number => value !== null);
          return {
            id: classRow.id,
            name: classRow.name,
            grade: classRow.grade,
            subject: classRow.subject ?? "غير محدد",
            studentsCount: classStudents.length,
            average: avg(classScores),
          };
        }),
        alerts: [
          ...(atRiskStudents.length ? [{ type: "risk", title: "طلاب يحتاجون تدخل", detail: `${atRiskStudents.length} طالب دون ${AT_RISK_THRESHOLD}%` }] : []),
          ...(!students.length ? [{ type: "empty", title: "لا توجد بيانات طلاب", detail: "ابدأ بإضافة الفصول والطلاب من لوحة المعلم." }] : []),
          ...(!scoredStudents.length ? [{ type: "empty", title: "لا توجد نتائج بعد", detail: "ستظهر مؤشرات الأداء بعد إدخال نتائج الطلاب." }] : []),
        ],
        notes: [
          performanceAverage === null ? "لا توجد درجات كافية لحساب متوسط الأداء." : null,
          "المهارات الأضعف تستخدم المادة كبديل مؤقت حتى تتوفر بيانات مهارة تفصيلية.",
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
