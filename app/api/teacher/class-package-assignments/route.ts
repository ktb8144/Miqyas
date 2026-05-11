import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminClient, requireUserRole } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

type ClassRow = {
  id: string;
  name: string;
  grade: number | null;
  subject: string | null;
  school_id: string;
  teacher_id: string;
};

type PackageRow = {
  id: string;
  title: string;
  subject: string;
  grade: number;
  week_number: number | null;
  duration_minutes: number | null;
  package_type: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  student_pdf_url: string | null;
  questions_pdf_url: string | null;
  answer_sheet_pdf_url: string | null;
};

type AssignmentRow = {
  id: string;
  package_id: string;
  school_id: string;
  class_id: string;
  teacher_id: string;
  status: string;
  printed_at: string | null;
  scanned_at: string | null;
  completed_at: string | null;
  created_at: string;
};

const createSchema = z.object({
  packageId: z.string().uuid(),
  classId: z.string().uuid(),
});

function normalizeSubject(subject: string | null | undefined) {
  const value = (subject ?? "").trim();
  if (["لغة عربية", "اللغة العربية", "عربية", "قراءة", "لغتي"].includes(value)) return "لغة عربية";
  if (value === "رياضيات" || value === "الرياضيات") return "رياضيات";
  if (value === "علوم" || value === "العلوم") return "علوم";
  return value;
}

function canMatchPackageToClass(assessmentPackage: PackageRow, classItem: ClassRow) {
  const classGrade = Number(classItem.grade);
  const hasGrade = Number.isFinite(classGrade);
  const hasSubject = Boolean(classItem.subject?.trim());
  if (hasGrade && classGrade !== assessmentPackage.grade) return false;
  if (hasSubject && normalizeSubject(classItem.subject) !== normalizeSubject(assessmentPackage.subject)) return false;
  return true;
}

async function countPackageQuestions(packageIds: string[]) {
  const db = getAdminClient();
  const entries = await Promise.all(
    Array.from(new Set(packageIds)).map(async (packageId) => {
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

function shapeAssignment(row: AssignmentRow, assessmentPackage?: PackageRow, classItem?: ClassRow, questionCount = 0) {
  return {
    id: row.id,
    packageId: row.package_id,
    packageTitle: assessmentPackage?.title ?? "اختبار مقياس",
    subject: assessmentPackage?.subject ?? "",
    grade: assessmentPackage?.grade ?? null,
    weekNumber: assessmentPackage?.week_number ?? null,
    durationMinutes: assessmentPackage?.duration_minutes ?? null,
    packageType: assessmentPackage?.package_type ?? "weekly",
    startDate: assessmentPackage?.start_date ?? null,
    endDate: assessmentPackage?.end_date ?? null,
    classId: row.class_id,
    className: classItem?.name ?? "فصل غير محدد",
    status: row.status,
    printedAt: row.printed_at,
    scannedAt: row.scanned_at,
    completedAt: row.completed_at,
    studentPdfUrl: assessmentPackage?.questions_pdf_url ?? assessmentPackage?.student_pdf_url ?? null,
    answerSheetPdfUrl: assessmentPackage?.answer_sheet_pdf_url ?? null,
    questionCount,
  };
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
    const { data: assignmentRows, error: assignmentsError } = await db
      .from("class_package_assignments")
      .select("id, package_id, school_id, class_id, teacher_id, status, printed_at, scanned_at, completed_at, created_at")
      .eq("teacher_id", auth.profile.id)
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false });

    if (assignmentsError) throw assignmentsError;

    const assignments = (assignmentRows ?? []) as AssignmentRow[];
    if (!assignments.length) {
      return NextResponse.json({ success: true, assignments: [] });
    }

    const packageIds = Array.from(new Set(assignments.map((item) => item.package_id)));
    const classIds = Array.from(new Set(assignments.map((item) => item.class_id)));

    const [packagesResult, classesResult, questionCounts] = await Promise.all([
      db
        .from("assessment_packages")
        .select("id, title, subject, grade, week_number, duration_minutes, package_type, status, start_date, end_date, student_pdf_url, questions_pdf_url, answer_sheet_pdf_url")
        .in("id", packageIds),
      db
        .from("classes")
        .select("id, name, grade, subject, school_id, teacher_id")
        .in("id", classIds)
        .eq("school_id", schoolId)
        .eq("teacher_id", auth.profile.id),
      countPackageQuestions(packageIds),
    ]);

    if (packagesResult.error) throw packagesResult.error;
    if (classesResult.error) throw classesResult.error;

    const packagesById = new Map(((packagesResult.data ?? []) as PackageRow[]).map((item) => [item.id, item]));
    const classesById = new Map(((classesResult.data ?? []) as ClassRow[]).map((item) => [item.id, item]));

    return NextResponse.json({
      success: true,
      assignments: assignments.map((item) =>
        shapeAssignment(item, packagesById.get(item.package_id), classesById.get(item.class_id), questionCounts.get(item.package_id) ?? 0)
      ),
    });
  } catch (err) {
    console.error("teacher class package assignments failed", err);
    return NextResponse.json(
      { success: false, error: "تعذر تحميل اختبارات الفصول" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireUserRole(req, ["teacher"]);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "يرجى اختيار اختبار وفصل صحيحين" }, { status: 400 });
    }

    const schoolId = auth.profile.school_id;
    if (!schoolId) {
      return NextResponse.json({ success: false, error: "حساب المعلم غير مرتبط بمدرسة" }, { status: 400 });
    }

    const db = getAdminClient();
    const { packageId, classId } = parsed.data;

    const [classResult, packageResult, schoolAssignmentResult] = await Promise.all([
      db
        .from("classes")
        .select("id, name, grade, subject, school_id, teacher_id")
        .eq("id", classId)
        .eq("school_id", schoolId)
        .eq("teacher_id", auth.profile.id)
        .maybeSingle(),
      db
        .from("assessment_packages")
        .select("id, title, subject, grade, week_number, duration_minutes, package_type, status, start_date, end_date, student_pdf_url, questions_pdf_url, answer_sheet_pdf_url")
        .eq("id", packageId)
        .maybeSingle(),
      db
        .from("school_package_assignments")
        .select("id, status")
        .eq("package_id", packageId)
        .eq("school_id", schoolId)
        .in("status", ["available", "active", "completed"])
        .limit(1)
        .maybeSingle(),
    ]);

    if (classResult.error) throw classResult.error;
    if (packageResult.error) throw packageResult.error;
    if (schoolAssignmentResult.error) throw schoolAssignmentResult.error;

    const classItem = classResult.data as ClassRow | null;
    const assessmentPackage = packageResult.data as PackageRow | null;

    if (!classItem) {
      return NextResponse.json({ success: false, error: "الفصل غير مرتبط بحساب المعلم الحالي" }, { status: 403 });
    }

    if (!assessmentPackage || assessmentPackage.status !== "published") {
      return NextResponse.json({ success: false, error: "الاختبار غير منشور أو غير متاح" }, { status: 404 });
    }

    if (!schoolAssignmentResult.data) {
      return NextResponse.json({ success: false, error: "هذا الاختبار غير مفعّل لمدرستك" }, { status: 403 });
    }

    if (!canMatchPackageToClass(assessmentPackage, classItem)) {
      return NextResponse.json(
        { success: false, error: "الاختبار لا يطابق صف أو مادة الفصل المختار" },
        { status: 400 }
      );
    }

    const { data: existing, error: existingError } = await db
      .from("class_package_assignments")
      .select("id, package_id, school_id, class_id, teacher_id, status, printed_at, scanned_at, completed_at, created_at")
      .eq("package_id", packageId)
      .eq("class_id", classId)
      .eq("teacher_id", auth.profile.id)
      .maybeSingle();

    if (existingError) throw existingError;

    if (existing) {
      const questionCounts = await countPackageQuestions([packageId]);
      return NextResponse.json({
        success: true,
        alreadyExists: true,
        assignment: shapeAssignment(existing as AssignmentRow, assessmentPackage, classItem, questionCounts.get(packageId) ?? 0),
      });
    }

    const { data: inserted, error: insertError } = await db
      .from("class_package_assignments")
      .insert({
        package_id: packageId,
        school_id: schoolId,
        class_id: classId,
        teacher_id: auth.profile.id,
        status: "assigned",
      })
      .select("id, package_id, school_id, class_id, teacher_id, status, printed_at, scanned_at, completed_at, created_at")
      .single();

    if (insertError) throw insertError;

    const questionCounts = await countPackageQuestions([packageId]);
    return NextResponse.json({
      success: true,
      alreadyExists: false,
      assignment: shapeAssignment(inserted as AssignmentRow, assessmentPackage, classItem, questionCounts.get(packageId) ?? 0),
    });
  } catch (err) {
    console.error("create class package assignment failed", err);
    return NextResponse.json(
      { success: false, error: "تعذر تطبيق الاختبار على الفصل" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireUserRole(req, ["teacher"]);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const parsed = z.object({
      assignmentId: z.string().uuid(),
      action: z.literal("mark_printed"),
    }).safeParse(await req.json());

    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "طلب تحديث غير صالح" }, { status: 400 });
    }

    const schoolId = auth.profile.school_id;
    if (!schoolId) {
      return NextResponse.json({ success: false, error: "حساب المعلم غير مرتبط بمدرسة" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const db = getAdminClient();
    const { data, error } = await db
      .from("class_package_assignments")
      .update({ status: "printed", printed_at: now })
      .eq("id", parsed.data.assignmentId)
      .eq("teacher_id", auth.profile.id)
      .eq("school_id", schoolId)
      .select("id")
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ success: false, error: "لم يتم العثور على تعيين الاختبار" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("mark class package printed failed", err);
    return NextResponse.json(
      { success: false, error: "تعذر تحديث حالة الطباعة" },
      { status: 500 }
    );
  }
}
