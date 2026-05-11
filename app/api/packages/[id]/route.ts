import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, requireUserRole } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

type Params = {
  params: {
    id: string;
  };
};

async function canAccessPackage(packageId: string, profile: { role: string; school_id?: string | null }) {
  if (profile.role === "admin") return true;
  if (!profile.school_id) return false;

  const { data, error } = await getAdminClient()
    .from("school_package_assignments")
    .select("id")
    .eq("package_id", packageId)
    .eq("school_id", profile.school_id)
    .in("status", ["available", "active", "completed"])
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
}

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireUserRole(req, ["admin", "principal", "teacher"]);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const packageId = params.id;
    const hasAccess = await canAccessPackage(packageId, auth.profile);
    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: "ليست لديك صلاحية لعرض هذه الحزمة" },
        { status: 403 }
      );
    }

    const db = getAdminClient();
    let query = db
      .from("assessment_packages")
      .select(`
        id,
        title,
        description,
        subject,
        grade,
        week_number,
        start_date,
        end_date,
        status,
        student_pdf_url,
        questions_pdf_url,
        answer_sheet_pdf_url,
        published_at,
        created_at
      `)
      .eq("id", packageId);

    if (auth.profile.role !== "admin") query = query.eq("status", "published");

    const { data: assessmentPackage, error } = await query.single();
    if (error) throw error;

    const { count, error: countError } = await db
      .from("package_questions")
      .select("id", { count: "exact", head: true })
      .eq("package_id", packageId);

    if (countError) throw countError;

    return NextResponse.json({
      success: true,
      package: {
        ...assessmentPackage,
        student_pdf_url: assessmentPackage.questions_pdf_url ?? assessmentPackage.student_pdf_url,
        questions_pdf_url: assessmentPackage.questions_pdf_url ?? assessmentPackage.student_pdf_url,
        question_count: count ?? 0,
      },
    });
  } catch (err) {
    console.error("package detail failed", err);
    return NextResponse.json(
      { success: false, error: "تعذر تحميل تفاصيل الحزمة" },
      { status: 500 }
    );
  }
}
