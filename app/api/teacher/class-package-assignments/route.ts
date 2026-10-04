import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase-admin";
import { requireUserRole, authErrorResponse } from "@/lib/auth";
import { normalizeSubject } from "@/lib/subjects";
import { countPackageQuestions } from "@/lib/packages";
import { fetchAllRows } from "@/lib/db/paginate";
import { average } from "@/lib/math";
import { saudiToday, testPhase, testWindow } from "@/lib/test-schedule";
import type {
  AssessmentPackageRow,
  ClassPackageAssignmentRow,
  ClassRow as DbClassRow,
} from "@/lib/db/rows";

export const dynamic = "force-dynamic";

type ClassRow = Pick<DbClassRow, "id" | "name" | "grade" | "subject" | "school_id" | "teacher_id">;

type PackageRow = Pick<AssessmentPackageRow, "id" | "title" | "subject" | "grade" | "week_number" | "duration_minutes" | "package_type" | "status" | "start_date" | "end_date" | "student_pdf_url" | "questions_pdf_url" | "answer_sheet_pdf_url">;

type AssignmentRow = Pick<ClassPackageAssignmentRow, "id" | "package_id" | "school_id" | "class_id" | "teacher_id" | "status" | "printed_at" | "scanned_at" | "completed_at" | "created_at">;

const createSchema = z.object({
  packageId: z.string().uuid(),
  classId: z.string().uuid(),
});

function canMatchPackageToClass(assessmentPackage: PackageRow, classItem: ClassRow) {
  const classGrade = Number(classItem.grade);
  const hasGrade = Number.isFinite(classGrade);
  const hasSubject = Boolean(classItem.subject?.trim());
  if (hasGrade && classGrade !== assessmentPackage.grade) return false;
  if (hasSubject && normalizeSubject(classItem.subject) !== normalizeSubject(assessmentPackage.subject)) return false;
  return true;
}

function shapeAssignment(row: AssignmentRow, assessmentPackage?: PackageRow, classItem?: ClassRow, questionCount = 0) {
  return {
    id: row.id,
    packageId: row.package_id,
    packageTitle: assessmentPackage?.title ?? "اختبار دالة",
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

/**
 * Creates class assignments for this week's (and next few days') tests that match the
 * teacher's classes, so a teacher never has to pick a test or "apply" it to a class.
 * Covers classes created after the test was published.
 */
async function ensureCurrentAssignments(db: ReturnType<typeof getAdminClient>, teacherId: string, schoolId: string) {
  const [classesRes, schoolPkgRes, existingRes] = await Promise.all([
    db.from("classes").select("id, name, grade, subject, school_id, teacher_id").eq("teacher_id", teacherId).eq("school_id", schoolId),
    db.from("school_package_assignments").select("package_id").eq("school_id", schoolId).in("status", ["available", "active", "completed"]),
    db.from("class_package_assignments").select("package_id, class_id").eq("teacher_id", teacherId).eq("school_id", schoolId),
  ]);
  if (classesRes.error) throw classesRes.error;
  if (schoolPkgRes.error) throw schoolPkgRes.error;
  if (existingRes.error) throw existingRes.error;

  const classes = (classesRes.data ?? []) as ClassRow[];
  const packageIds = Array.from(new Set((schoolPkgRes.data ?? []).map((row) => row.package_id as string)));
  if (!classes.length || !packageIds.length) return;

  const { data: packageRows, error: packagesError } = await db
    .from("assessment_packages")
    .select("id, title, subject, grade, week_number, duration_minutes, package_type, status, start_date, end_date, published_at, created_at, student_pdf_url, questions_pdf_url, answer_sheet_pdf_url")
    .in("id", packageIds)
    .eq("status", "published");
  if (packagesError) throw packagesError;

  const today = saudiToday();
  const openPackages = ((packageRows ?? []) as (PackageRow & { published_at: string | null; created_at: string | null })[])
    .filter((item) => ["upcoming", "current"].includes(testPhase(item, today)));
  if (!openPackages.length) return;

  const existing = new Set((existingRes.data ?? []).map((row) => `${row.package_id}:${row.class_id}`));
  const questionCounts = await countPackageQuestions(openPackages.map((item) => item.id));

  const rows = openPackages.flatMap((item) =>
    (questionCounts.get(item.id) ?? 0) > 0
      ? classes
          .filter((classItem) => canMatchPackageToClass(item, classItem) && classItem.grade !== null && classItem.subject)
          .filter((classItem) => !existing.has(`${item.id}:${classItem.id}`))
          .map((classItem) => ({ package_id: item.id, school_id: schoolId, class_id: classItem.id, teacher_id: teacherId, status: "assigned" }))
      : []
  );
  if (rows.length) {
    const { error } = await db.from("class_package_assignments").insert(rows);
    if (error) throw error;
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireUserRole(req, ["teacher"]);
  if (!auth.ok) return authErrorResponse(auth);

  try {
    const schoolId = auth.profile.school_id;
    if (!schoolId) {
      return NextResponse.json({ success: false, error: "حساب المعلم غير مرتبط بمدرسة" }, { status: 400 });
    }

    const db = getAdminClient();
    try {
      await ensureCurrentAssignments(db, auth.profile.id, schoolId);
    } catch (err) {
      // Never block the list because of auto-assignment.
      console.error("auto-assign current tests failed", err);
    }

    const { data: assignmentRows, error: assignmentsError } = await db
      .from("class_package_assignments")
      .select("id, package_id, school_id, class_id, teacher_id, status, printed_at, scanned_at, completed_at, created_at")
      .eq("teacher_id", auth.profile.id)
      .eq("school_id", schoolId)
      .neq("status", "withdrawn")
      .order("created_at", { ascending: false });

    if (assignmentsError) throw assignmentsError;

    const assignments = (assignmentRows ?? []) as AssignmentRow[];
    if (!assignments.length) {
      return NextResponse.json({ success: true, today: saudiToday(), assignments: [] });
    }

    const packageIds = Array.from(new Set(assignments.map((item) => item.package_id)));
    const classIds = Array.from(new Set(assignments.map((item) => item.class_id)));

    const [packagesResult, classesResult, questionCounts, results] = await Promise.all([
      db
        .from("assessment_packages")
        .select("id, title, subject, grade, week_number, duration_minutes, package_type, status, start_date, end_date, published_at, created_at, student_pdf_url, questions_pdf_url, answer_sheet_pdf_url")
        .in("id", packageIds),
      db
        .from("classes")
        .select("id, name, grade, subject, school_id, teacher_id")
        .in("id", classIds)
        .eq("school_id", schoolId)
        .eq("teacher_id", auth.profile.id),
      countPackageQuestions(packageIds),
      fetchAllRows<{ class_package_assignment_id: string; percentage: number | string | null }>((from, to) =>
        db
          .from("student_package_results")
          .select("class_package_assignment_id, percentage")
          .eq("teacher_id", auth.profile.id)
          .in("class_package_assignment_id", assignments.map((item) => item.id))
          .order("id")
          .range(from, to)
      ),
    ]);

    if (packagesResult.error) throw packagesResult.error;
    if (classesResult.error) throw classesResult.error;

    const packagesById = new Map(((packagesResult.data ?? []) as (PackageRow & { published_at: string | null; created_at: string | null })[]).map((item) => [item.id, item]));
    const classesById = new Map(((classesResult.data ?? []) as ClassRow[]).map((item) => [item.id, item]));
    const percentagesByAssignment = new Map<string, number[]>();
    for (const row of results) {
      const pct = Number(row.percentage);
      if (!Number.isFinite(pct)) continue;
      percentagesByAssignment.set(row.class_package_assignment_id, [...(percentagesByAssignment.get(row.class_package_assignment_id) ?? []), pct]);
    }

    const today = saudiToday();
    return NextResponse.json({
      success: true,
      today,
      assignments: assignments
        .filter((item) => classesById.has(item.class_id))
        .map((item) => {
          const assessmentPackage = packagesById.get(item.package_id);
          const window = assessmentPackage ? testWindow(assessmentPackage) : { start: null, end: null };
          const percentages = percentagesByAssignment.get(item.id) ?? [];
          return {
            ...shapeAssignment(item, assessmentPackage, classesById.get(item.class_id), questionCounts.get(item.package_id) ?? 0),
            startDate: window.start,
            endDate: window.end,
            phase: assessmentPackage ? testPhase(assessmentPackage, today) : "past",
            testedCount: percentages.length,
            average: average(percentages),
          };
        }),
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
  if (!auth.ok) return authErrorResponse(auth);

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

    const { count: questionCount, error: questionCountError } = await db
      .from("package_questions")
      .select("id", { count: "exact", head: true })
      .eq("package_id", packageId);
    if (questionCountError) throw questionCountError;
    if (!questionCount) {
      return NextResponse.json({ success: false, error: "لا يمكن تطبيق اختبار بدون مفتاح إجابة" }, { status: 400 });
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
  if (!auth.ok) return authErrorResponse(auth);

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
