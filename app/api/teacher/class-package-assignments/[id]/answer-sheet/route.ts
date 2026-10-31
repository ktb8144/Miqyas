import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase-admin";
import { requireUserRole, authErrorResponse } from "@/lib/auth";
import { normalizeStudentCode } from "@/lib/format";

export const dynamic = "force-dynamic";

type AssignmentRow = {
  id: string;
  package_id: string | null;
  class_id: string;
  assessment_packages: { title: string | null; subject: string | null; grade: number | null; student_pdf_url: string | null } | null;
};

/** Everything the printable answer sheet needs for one class: test, class, students and their numbers. */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUserRole(req, ["teacher"]);
  if (!auth.ok) return authErrorResponse(auth);

  try {
    const db = getAdminClient();
    const schoolId = auth.profile.school_id;
    if (!schoolId) {
      return NextResponse.json({ success: false, error: "حساب المعلم غير مرتبط بمدرسة" }, { status: 400 });
    }

    const { data, error } = await db
      .from("class_package_assignments")
      .select("id, package_id, class_id, assessment_packages(title, subject, grade, student_pdf_url)")
      .eq("id", params.id)
      .eq("school_id", schoolId)
      .eq("teacher_id", auth.profile.id)
      .maybeSingle();
    if (error) throw error;
    const assignment = data as unknown as AssignmentRow | null;
    if (!assignment?.package_id) {
      return NextResponse.json({ success: false, error: "لم يتم العثور على اختبار مرتبط بحسابك" }, { status: 404 });
    }

    // Classes and schools are read with their own queries (simple, and works even if an embed changes).
    const [
      { count, error: countError },
      { data: students, error: studentsError },
      { data: classRow },
      { data: schoolRow },
      { data: codeRow },
    ] = await Promise.all([
      db.from("package_questions").select("id", { count: "exact", head: true }).eq("package_id", assignment.package_id),
      db
        .from("students")
        .select("id, name, student_code")
        .eq("class_id", assignment.class_id)
        .eq("school_id", schoolId)
        .order("created_at", { ascending: true }),
      db.from("classes").select("name").eq("id", assignment.class_id).maybeSingle(),
      db.from("schools").select("name").eq("id", schoolId).maybeSingle(),
      // Own query: before migration 20261031010000 the column is missing and this simply yields no code.
      db.from("class_package_assignments").select("sheet_code").eq("id", assignment.id).maybeSingle(),
    ]);
    if (countError) throw countError;
    if (studentsError) throw studentsError;

    const roster = ((students ?? []) as Array<{ id: string; name: string; student_code: string | null }>)
      .map((student) => ({ id: student.id, name: student.name, code: Number(normalizeStudentCode(student.student_code)) || null }))
      .sort((a, b) => (a.code ?? 999) - (b.code ?? 999));

    return NextResponse.json({
      success: true,
      data: {
        assignmentId: assignment.id,
        packageId: assignment.package_id,
        /** This class's code for the QR on its sheets (issued by the database). */
        sheetCode: (codeRow as { sheet_code?: string | null } | null)?.sheet_code ?? null,
        title: assignment.assessment_packages?.title ?? "اختبار دالة",
        subject: assignment.assessment_packages?.subject ?? "",
        grade: assignment.assessment_packages?.grade ?? null,
        questionsPdfUrl: assignment.assessment_packages?.student_pdf_url ?? null,
        className: (classRow as { name?: string | null } | null)?.name ?? "",
        schoolName: (schoolRow as { name?: string | null } | null)?.name ?? "",
        questionCount: count ?? 0,
        students: roster,
      },
    });
  } catch (err) {
    console.error("answer sheet data failed", err);
    return NextResponse.json({ success: false, error: "تعذر تجهيز ورقة الإجابة" }, { status: 500 });
  }
}
