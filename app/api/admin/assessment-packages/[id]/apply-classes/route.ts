import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/auth";
import { createClassAssignmentsForPackage } from "@/lib/assessment";

export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const db = getAdminClient();
    const { data: assessmentPackage, error: packageError } = await db
      .from("assessment_packages")
      .select("id, subject, grade, status")
      .eq("id", params.id)
      .maybeSingle();

    if (packageError) throw packageError;
    if (!assessmentPackage) {
      return NextResponse.json({ success: false, error: "لم يتم العثور على حزمة الاختبار" }, { status: 404 });
    }

    if (assessmentPackage.status !== "published") {
      return NextResponse.json({ success: false, error: "يجب نشر الحزمة قبل تطبيقها على الفصول" }, { status: 400 });
    }

    const { data: schoolAssignments, error: schoolError } = await db
      .from("school_package_assignments")
      .select("school_id")
      .eq("package_id", params.id)
      .in("status", ["available", "active", "completed"]);

    if (schoolError) throw schoolError;
    const schoolIds = Array.from(new Set((schoolAssignments ?? []).map((item) => item.school_id as string).filter(Boolean)));
    if (!schoolIds.length) {
      return NextResponse.json({ success: false, error: "لا توجد مدارس منشورة لهذه الحزمة" }, { status: 400 });
    }

    const result = await createClassAssignmentsForPackage({ db, assessmentPackage, schoolIds });
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error("admin package apply classes failed", err);
    return NextResponse.json(
      { success: false, error: "تعذر تطبيق الحزمة على الفصول المطابقة" },
      { status: 500 }
    );
  }
}
