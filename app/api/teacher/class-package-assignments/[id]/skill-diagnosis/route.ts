import { NextRequest, NextResponse } from "next/server";
import { requireUserRole } from "@/lib/supabase-admin";
import { analyzeClassPackageAssignmentSkills } from "@/lib/assessment/skill-diagnosis-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUserRole(req, ["teacher"]);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const schoolId = auth.profile.school_id;
    if (!schoolId) {
      return NextResponse.json({ success: false, error: "حساب المعلم غير مرتبط بمدرسة" }, { status: 400 });
    }

    const diagnosis = await analyzeClassPackageAssignmentSkills({
      assignmentId: params.id,
      teacherId: auth.profile.id,
      schoolId,
    });

    return NextResponse.json(
      { success: true, data: diagnosis },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
    );
  } catch (err) {
    console.error("teacher skill diagnosis failed", err);
    const message = err instanceof Error && err.message.includes("لم يتم العثور")
      ? err.message
      : "تعذر تحليل المهارات لهذا الاختبار";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
