import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, requireUserRole } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

type ClassRow = {
  id: string;
  name: string;
  grade: number | null;
  subject: string | null;
};

type SchoolAssignmentRow = {
  id: string;
  package_id: string;
  status: string;
};

type PackageRow = {
  id: string;
  title: string;
  description: string | null;
  subject: string;
  grade: number;
  week_number: number | null;
  duration_minutes: number | null;
  package_type: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  student_pdf_url: string | null;
  questions_pdf_url: string | null;
  answer_sheet_pdf_url: string | null;
  published_at: string | null;
  created_at: string;
};

function normalizeSubject(subject: string | null | undefined) {
  const value = (subject ?? "").trim();
  if (["لغة عربية", "اللغة العربية", "عربية", "قراءة", "لغتي"].includes(value)) return "لغة عربية";
  if (value === "رياضيات" || value === "الرياضيات") return "رياضيات";
  if (value === "علوم" || value === "العلوم") return "علوم";
  return value;
}

function classMatchesPackage(classItem: ClassRow, assessmentPackage: PackageRow) {
  const grade = Number(classItem.grade);
  const classSubject = normalizeSubject(classItem.subject);
  return Number.isFinite(grade) && grade === assessmentPackage.grade && classSubject === normalizeSubject(assessmentPackage.subject);
}

async function countPackageQuestions(packageIds: string[]) {
  const db = getAdminClient();
  const entries = await Promise.all(
    packageIds.map(async (packageId) => {
      const { count, error } = await db
        .from("package_questions")
        .select("id", { count: "exact", head: true })
        .eq("package_id", packageId);

      if (error) throw error;
      return [packageId, count ?? 0] as const;
    })
  );

  return new Map(entries);
}

export async function GET(req: NextRequest) {
  const auth = await requireUserRole(req, ["teacher"]);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

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
