import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const db = getAdminClient();
    const { data: assessmentPackage, error: packageError } = await db
      .from("assessment_packages")
      .select("id")
      .eq("id", params.id)
      .maybeSingle();

    if (packageError) throw packageError;
    if (!assessmentPackage) {
      return NextResponse.json({ success: false, error: "لم يتم العثور على حزمة الاختبار" }, { status: 404 });
    }

    const [schoolUpdate, classUpdate] = await Promise.all([
      db
        .from("school_package_assignments")
        .update({ status: "withdrawn" })
        .eq("package_id", params.id)
        .neq("status", "withdrawn")
        .select("id"),
      db
        .from("class_package_assignments")
        .update({ status: "withdrawn" })
        .eq("package_id", params.id)
        .neq("status", "withdrawn")
        .select("id"),
    ]);

    if (schoolUpdate.error) throw schoolUpdate.error;
    if (classUpdate.error) throw classUpdate.error;

    await db.from("audit_logs").insert({
      actor_user_id: null,
      action: "assessment_package.withdraw",
      entity_type: "assessment_package",
      entity_id: params.id,
      metadata: {
        school_assignments: schoolUpdate.data?.length ?? 0,
        class_assignments: classUpdate.data?.length ?? 0,
      },
    });

    return NextResponse.json({
      success: true,
      withdrawnSchoolAssignments: schoolUpdate.data?.length ?? 0,
      withdrawnClassAssignments: classUpdate.data?.length ?? 0,
    });
  } catch (err) {
    console.error("admin package withdraw failed", err);
    return NextResponse.json(
      { success: false, error: "تعذر سحب حزمة الاختبار" },
      { status: 500 }
    );
  }
}
