import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase-admin";
import { requireUserRole, authErrorResponse } from "@/lib/auth";
import { countPackageQuestions, classMatchesPackage } from "@/lib/packages";
import type { AssessmentPackageRow, ClassRow as DbClassRow } from "@/lib/db/rows";

export const dynamic = "force-dynamic";

type ClassRow = Pick<DbClassRow, "id" | "name" | "grade" | "subject">;

type SchoolAssignmentRow = {
  id: string;
  package_id: string;
  status: string;
};

type PackageRow = Pick<AssessmentPackageRow, "id" | "title" | "description" | "subject" | "grade" | "week_number" | "duration_minutes" | "package_type" | "start_date" | "end_date" | "status" | "student_pdf_url" | "questions_pdf_url" | "answer_sheet_pdf_url" | "published_at" | "created_at">;

export async function GET(req: NextRequest) {
  const auth = await requireUserRole(req, ["teacher"]);
  if (!auth.ok) return authErrorResponse(auth);

  try {
    const schoolId = auth.profile.school_id;
    if (!schoolId) {
      return NextResponse.json({ success: false, error: "حساب المعلم غير مرتبط بمدرسة" }, { status: 400 });
    }

    const db = getAdminClient();
    const [classesResult, assignmentsResult] = await Promise.all([
      db
        .from("classes")
        .select("id, name, grade, subject")
        .eq("teacher_id", auth.profile.id)
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false }),
      db
        .from("school_package_assignments")
        .select("id, package_id, status")
        .eq("school_id", schoolId)
        .in("status", ["available", "active", "completed"]),
    ]);

    if (classesResult.error) throw classesResult.error;
    if (assignmentsResult.error) throw assignmentsResult.error;

    const classes = (classesResult.data ?? []) as ClassRow[];
    const schoolAssignments = (assignmentsResult.data ?? []) as SchoolAssignmentRow[];
    const packageIds = Array.from(new Set(schoolAssignments.map((assignment) => assignment.package_id)));

    if (!packageIds.length) {
      return NextResponse.json({ success: true, packages: [] });
    }

    const { data: packageRows, error: packagesError } = await db
      .from("assessment_packages")
      .select(`
        id,
        title,
        description,
        subject,
        grade,
        week_number,
        duration_minutes,
        package_type,
        start_date,
        end_date,
        status,
        student_pdf_url,
        questions_pdf_url,
        answer_sheet_pdf_url,
        published_at,
        created_at
      `)
      .in("id", packageIds)
      .eq("status", "published")
      .order("week_number", { ascending: true });

    if (packagesError) throw packagesError;

    const packages = (packageRows ?? []) as PackageRow[];
    const countsByPackage = await countPackageQuestions(packages.map((item) => item.id));
    const assignmentByPackage = new Map(schoolAssignments.map((assignment) => [assignment.package_id, assignment]));

    return NextResponse.json({
      success: true,
      packages: packages.map((item) => ({
        id: item.id,
        title: item.title,
        description: item.description,
        subject: item.subject,
        grade: item.grade,
        week_number: item.week_number,
        duration_minutes: item.duration_minutes,
        package_type: item.package_type ?? "weekly",
        start_date: item.start_date,
        end_date: item.end_date,
        student_pdf_url: item.questions_pdf_url ?? item.student_pdf_url,
        questions_pdf_url: item.questions_pdf_url ?? item.student_pdf_url,
        answer_sheet_pdf_url: item.answer_sheet_pdf_url,
        question_count: countsByPackage.get(item.id) ?? 0,
        schoolAssignmentStatus: assignmentByPackage.get(item.id)?.status ?? "available",
        matchingClasses: classes
          .filter((classItem) => classMatchesPackage(classItem, item))
          .map((classItem) => ({ id: classItem.id, name: classItem.name })),
      })),
    });
  } catch (err) {
    console.error("teacher assessment packages failed", err);
    return NextResponse.json(
      { success: false, error: "تعذر تحميل اختبارات مقياس المنشورة" },
      { status: 500 }
    );
  }
}
