import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase-admin";
import { requireUserRole, authErrorResponse } from "@/lib/auth";
import { getSchoolPlan } from "@/lib/plan";

export const dynamic = "force-dynamic";

/** The signed-in user's school plan: trial dates, papers used, and the teachers' join code. */
export async function GET(req: NextRequest) {
  const auth = await requireUserRole(req, ["principal", "teacher", "supervisor"]);
  if (!auth.ok) return authErrorResponse(auth);
  if (!auth.profile.school_id) return NextResponse.json({ success: true, plan: null });

  try {
    const db = getAdminClient();
    const [plan, schoolRes] = await Promise.all([
      getSchoolPlan(db, auth.profile.school_id),
      db.from("schools").select("join_code, name").eq("id", auth.profile.school_id).maybeSingle(),
    ]);
    return NextResponse.json({
      success: true,
      plan,
      // Only the principal shares the code with teachers.
      joinCode: auth.profile.role === "principal" ? schoolRes.data?.join_code ?? null : null,
      schoolName: schoolRes.data?.name ?? null,
    });
  } catch (err) {
    console.error("account plan failed", err);
    return NextResponse.json({ success: false, error: "تعذر تحميل بيانات الاشتراك" }, { status: 500 });
  }
}
