import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, requireUserRole } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

type ResultRow = {
  id: string;
  student_id: string;
  score: number | string;
  total: number | string;
  percentage: number | string | null;
  level: string | null;
  scanned_at: string | null;
  created_at: string | null;
};

type StudentRow = {
  id: string;
  name: string;
  student_code: string | null;
};

type QuestionResultRow = {
  is_correct: boolean;
  nafs_domains?: { domain_name?: string | null } | null;
  learning_skills?: { skill_name?: string | null } | null;
};

function pct(value: number | string | null | undefined) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.round(numeric) : 0;
}

function weakest(items: Array<{ name: string; isCorrect: boolean }>) {
  const grouped = new Map<string, { name: string; wrong: number; total: number }>();
  items.forEach((item) => {
    if (!item.name) return;
    const current = grouped.get(item.name) ?? { name: item.name, wrong: 0, total: 0 };
    current.total += 1;
    if (!item.isCorrect) current.wrong += 1;
    grouped.set(item.name, current);
  });
  return Array.from(grouped.values())
    .filter((item) => item.wrong > 0)
    .sort((a, b) => b.wrong / b.total - a.wrong / a.total)
    .slice(0, 6);
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUserRole(req, ["teacher"]);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const db = getAdminClient();
    const schoolId = auth.profile.school_id;
    if (!schoolId) {
      return NextResponse.json({ success: false, error: "حساب المعلم غير مرتبط بمدرسة" }, { status: 400 });
    }

    const { data: assignment, error: assignmentError } = await db
      .from("class_package_assignments")
      .select("id, package_id, school_id, class_id, teacher_id, status, assessment_packages(title, subject, grade, week_number), classes(name)")
      .eq("id", params.id)
      .eq("school_id", schoolId)
      .eq("teacher_id", auth.profile.id)
      .maybeSingle();

    if (assignmentError) throw assignmentError;
    if (!assignment) {
      return NextResponse.json({ success: false, error: "لم يتم العثور على اختبار مرتبط بحسابك" }, { status: 404 });
    }

    const { data: resultRows, error: resultsError } = await db
      .from("student_package_results")
      .select("id, student_id, score, total, percentage, level, scanned_at, created_at")
      .eq("class_package_assignment_id", params.id)
      .eq("school_id", schoolId)
      .eq("teacher_id", auth.profile.id)
      .order("scanned_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (resultsError) throw resultsError;

    const dedupedResults = new Map<string, ResultRow>();
    ((resultRows ?? []) as ResultRow[]).forEach((item) => {
      if (!dedupedResults.has(item.student_id)) {
        dedupedResults.set(item.student_id, item);
      }
    });
    const results = Array.from(dedupedResults.values());
    console.info("teacher package results loaded", {
      classPackageAssignmentId: params.id,
      loadedResults: results.length,
      studentIds: results.map((item) => item.student_id),
    });
    const studentIds = Array.from(new Set(results.map((item) => item.student_id)));
    const resultIds = results.map((item) => item.id);

    const [studentsResult, questionResultsResult] = await Promise.all([
      studentIds.length
        ? db.from("students").select("id, name, student_code").in("id", studentIds)
        : Promise.resolve({ data: [], error: null }),
      resultIds.length
        ? db
            .from("student_question_results")
            .select("is_correct, nafs_domains(domain_name), learning_skills(skill_name)")
            .in("student_package_result_id", resultIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (studentsResult.error) throw studentsResult.error;
    if (questionResultsResult.error) throw questionResultsResult.error;

    const studentsById = new Map(((studentsResult.data ?? []) as StudentRow[]).map((item) => [item.id, item]));
    const questionRows = (questionResultsResult.data ?? []) as QuestionResultRow[];
    const average = results.length
      ? Math.round(results.reduce((sum, item) => sum + pct(item.percentage), 0) / results.length)
      : null;

    const assignmentRecord = assignment as unknown as {
      id: string;
      status: string;
      assessment_packages?: { title?: string; subject?: string; grade?: number; week_number?: number | null } | Array<{ title?: string; subject?: string; grade?: number; week_number?: number | null }> | null;
      classes?: { name?: string } | Array<{ name?: string }> | null;
    };
    const assessmentPackage = Array.isArray(assignmentRecord.assessment_packages)
      ? assignmentRecord.assessment_packages[0]
      : assignmentRecord.assessment_packages;
    const classRow = Array.isArray(assignmentRecord.classes)
      ? assignmentRecord.classes[0]
      : assignmentRecord.classes;

    return NextResponse.json({
      success: true,
      data: {
        assignment: {
          id: assignmentRecord.id,
          status: assignmentRecord.status,
          packageTitle: assessmentPackage?.title,
          subject: assessmentPackage?.subject,
          grade: assessmentPackage?.grade,
          weekNumber: assessmentPackage?.week_number,
          className: classRow?.name,
        },
        summary: {
          studentsTestedCount: results.length,
          averagePercentage: average,
        },
        students: results.map((item) => {
          const student = studentsById.get(item.student_id);
          return {
            id: item.id,
            studentId: item.student_id,
            studentCode: student?.student_code ?? null,
            studentName: student?.name ?? "طالب غير محدد",
            score: Number(item.score),
            total: Number(item.total),
            percentage: pct(item.percentage),
            level: item.level ?? "",
            scannedAt: item.scanned_at,
          };
        }),
        weakestSkills: weakest(questionRows.map((item) => ({
          name: item.learning_skills?.skill_name ?? "مهارة غير محددة",
          isCorrect: item.is_correct,
        }))),
        weakestDomains: weakest(questionRows.map((item) => ({
          name: item.nafs_domains?.domain_name ?? "مجال غير محدد",
          isCorrect: item.is_correct,
        }))),
      },
    });
  } catch (err) {
    console.error("teacher package results failed", err);
    return NextResponse.json({ success: false, error: "تعذر تحميل نتائج اختبار مقياس" }, { status: 500 });
  }
}
