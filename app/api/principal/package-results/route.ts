import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase-admin";
import { requireUserRole, authErrorResponse } from "@/lib/auth";
import { toPercent } from "@/lib/math";
import type {
  AssessmentPackageRow,
  ClassPackageAssignmentRow,
  StudentPackageResultRow,
} from "@/lib/db/rows";

export const dynamic = "force-dynamic";

type AssignmentRow = Pick<ClassPackageAssignmentRow, "id" | "package_id" | "class_id" | "teacher_id" | "status" | "scanned_at">;

type PackageRow = Pick<AssessmentPackageRow, "id" | "title" | "subject" | "grade" | "week_number">;

type ResultRow = Pick<StudentPackageResultRow, "class_package_assignment_id" | "percentage">;

type QuestionResultRow = {
  is_correct: boolean;
  nafs_domains?: { domain_name?: string | null } | null;
  learning_skills?: { skill_name?: string | null } | null;
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
    .slice(0, 5);
}

export async function GET(req: NextRequest) {
  const auth = await requireUserRole(req, ["admin", "principal", "supervisor"]);
  if (!auth.ok) return authErrorResponse(auth);

  try {
    const schoolId = auth.profile.school_id;
    if (!schoolId && auth.profile.role !== "admin") {
      return NextResponse.json({ success: false, error: "حساب قائد المدرسة غير مرتبط بمدرسة" }, { status: 400 });
    }

    const db = getAdminClient();
    let assignmentsQuery = db
      .from("class_package_assignments")
      .select("id, package_id, class_id, teacher_id, status, scanned_at")
      .order("created_at", { ascending: false });

    if (schoolId) assignmentsQuery = assignmentsQuery.eq("school_id", schoolId);
    const { data: assignmentRows, error: assignmentsError } = await assignmentsQuery;
    if (assignmentsError) throw assignmentsError;

    const assignments = (assignmentRows ?? []) as AssignmentRow[];
    if (!assignments.length) {
      return NextResponse.json({ success: true, data: [] });
    }

    const packageIds = Array.from(new Set(assignments.map((item) => item.package_id)));
    const assignmentIds = assignments.map((item) => item.id);
    const [packagesResult, resultsResult, questionResultsResult] = await Promise.all([
      db.from("assessment_packages").select("id, title, subject, grade, week_number").in("id", packageIds),
      db
        .from("student_package_results")
        .select("class_package_assignment_id, percentage")
        .in("class_package_assignment_id", assignmentIds),
      db
        .from("student_question_results")
        .select("is_correct, package_id, nafs_domains(domain_name), learning_skills(skill_name)")
        .in("package_id", packageIds),
    ]);

    if (packagesResult.error) throw packagesResult.error;
    if (resultsResult.error) throw resultsResult.error;
    if (questionResultsResult.error) throw questionResultsResult.error;

    const packagesById = new Map(((packagesResult.data ?? []) as PackageRow[]).map((item) => [item.id, item]));
    const results = (resultsResult.data ?? []) as ResultRow[];
    const questionRows = (questionResultsResult.data ?? []) as Array<QuestionResultRow & { package_id?: string }>;

    const data = packageIds.map((packageId) => {
      const packageAssignments = assignments.filter((item) => item.package_id === packageId);
      const packageAssignmentIds = new Set(packageAssignments.map((item) => item.id));
      const packageResults = results.filter((item) => packageAssignmentIds.has(item.class_package_assignment_id));
      const average = packageResults.length
        ? Math.round(packageResults.reduce((sum, item) => sum + toPercent(item.percentage), 0) / packageResults.length)
        : null;
      const packageQuestionRows = questionRows.filter((item) => item.package_id === packageId);
      const scannedClasses = packageAssignments.filter((item) => item.status === "scanned" || item.scanned_at).length;
      const assessmentPackage = packagesById.get(packageId);

      return {
        packageId,
        title: assessmentPackage?.title ?? "اختبار مقياس",
        subject: assessmentPackage?.subject ?? "",
        grade: assessmentPackage?.grade ?? null,
        weekNumber: assessmentPackage?.week_number ?? null,
        classesAssigned: packageAssignments.length,
        classesScanned: scannedClasses,
        studentsTested: packageResults.length,
        averagePercentage: average,
        weakestDomains: weakest(packageQuestionRows.map((item) => ({
          name: item.nafs_domains?.domain_name ?? "مجال غير محدد",
          isCorrect: item.is_correct,
        }))),
        weakestSkills: weakest(packageQuestionRows.map((item) => ({
          name: item.learning_skills?.skill_name ?? "مهارة غير محددة",
          isCorrect: item.is_correct,
        }))),
      };
    });

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("principal package results failed", err);
    return NextResponse.json({ success: false, error: "تعذر تحميل ملخص اختبارات مقياس" }, { status: 500 });
  }
}
