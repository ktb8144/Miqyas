import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, requireAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const { data, error } = await getAdminClient()
      .from("assessment_packages")
      .update({ status: "archived" })
      .eq("id", params.id)
      .select("*")
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ success: false, error: "لم يتم العثور على حزمة الاختبار" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("admin package archive failed", err);
    return NextResponse.json(
      { success: false, error: "تعذر أرشفة حزمة الاختبار" },
      { status: 500 }
    );
  }
}
