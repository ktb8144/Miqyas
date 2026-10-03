import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase-admin";
import { requireUserRole, authErrorResponse } from "@/lib/auth";
import { toPercent } from "@/lib/math";
import type { StudentPackageResultRow, StudentRow as DbStudentRow } from "@/lib/db/rows";

export const dynamic = "force-dynamic";

type ResultRow = Pick<StudentPackageResultRow, "id" | "student_id" | "score" | "total" | "percentage" | "level" | "scanned_at" | "created_at">;

type StudentRow = Pick<DbStudentRow, "id" | "name" | "student_code">;

type QuestionResultRow = {
  is_correct: boolean;
  package_question_id: string | null;
};

type PackageQuestionRow = {
  id: string;
  skill_text: string | null;
  domain_text: string | null;
};

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
  if (!auth.ok) return authErrorResponse(auth);

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

    const studentsResult = await (
      studentIds.length
        ? db.from("students").select("id, name, student_code").in("id", studentIds)
        : Promise.resolve({ data: [], error: null })
    );

    if (studentsResult.error) throw studentsResult.error;

    const studentsById = new Map(((studentsResult.data ?? []) as StudentRow[]).map((item) => [item.id, item]));
    let weakestSkills: ReturnType<typeof weakest> = [];
    let weakestDomains: ReturnType<typeof weakest> = [];

    try {
      const questionResultsResult = resultIds.length
        ? await db
            .from("student_question_results")
            .select("is_correct, package_question_id")
            .in("student_package_result_id", resultIds)
        : { data: [], error: null };

      if (questionResultsResult.error) {
        console.warn("teacher package question results load failed", {
          classPackageAssignmentId: params.id,
          resultIdsCount: resultIds.length,
          questionResultsCount: 0,
          errorCode: "QUESTION_RESULTS_LOAD_FAILED",
          message: questionResultsResult.error.message,
        });
      } else {
        const questionRows = (questionResultsResult.data ?? []) as QuestionResultRow[];
        const packageQuestionIds = Array.from(
          new Set(questionRows.map((item) => item.package_question_id).filter(Boolean))
        ) as string[];
        let packageQuestionsById = new Map<string, PackageQuestionRow>();

        if (packageQuestionIds.length) {
          const packageQuestionsResult = await db
            .from("package_questions")
            .select("id, skill_text, domain_text")
            .in("id", packageQuestionIds);

          if (packageQuestionsResult.error) {
            console.warn("teacher package questions load failed", {
              classPackageAssignmentId: params.id,
              resultIdsCount: resultIds.length,
              questionResultsCount: questionRows.length,
              errorCode: "PACKAGE_QUESTIONS_LOAD_FAILED",
              message: packageQuestionsResult.error.message,
            });
          } else {
            packageQuestionsById = new Map(
              ((packageQuestionsResult.data ?? []) as PackageQuestionRow[]).map((item) => [item.id, item])
            );
          }
        }

        weakestSkills = weakest(questionRows.map((item) => ({
          name: packageQuestionsById.get(item.package_question_id ?? "")?.skill_text ?? "مهارة غير محددة",
          isCorrect: item.is_correct,
        })));
        weakestDomains = weakest(questionRows.map((item) => ({
          name: packageQuestionsById.get(item.package_question_id ?? "")?.domain_text ?? "مجال غير محدد",
          isCorrect: item.is_correct,
        })));

        console.info("teacher package question analysis loaded", {
          classPackageAssignmentId: params.id,
          resultIdsCount: resultIds.length,
          questionResultsCount: questionRows.length,
        });
      }
    } catch (analysisError) {
      console.warn("teacher package question analysis failed", {
        classPackageAssignmentId: params.id,
        resultIdsCount: resultIds.length,
        errorCode: "QUESTION_RESULTS_LOAD_FAILED",
        message: analysisError instanceof Error ? analysisError.message : String(analysisError),
      });
      weakestSkills = [];
      weakestDomains = [];
    }

    const average = results.length
      ? Math.round(results.reduce((sum, item) => sum + toPercent(item.percentage), 0) / results.length)
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
            percentage: toPercent(item.percentage),
            level: item.level ?? "",
            scannedAt: item.scanned_at,
          };
        }),
        weakestSkills,
        weakestDomains,
      },
    });
  } catch (err) {
    console.error("teacher package results failed", {
      classPackageAssignmentId: params.id,
      errorCode: "RESULTS_LOAD_FAILED",
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { success: false, error: "تعذر تحميل نتائج اختبار مقياس", errorCode: "RESULTS_LOAD_FAILED" },
      { status: 500 }
    );
  }
}
