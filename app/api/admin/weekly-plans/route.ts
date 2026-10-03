import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase-admin";
import { requireAdmin, authErrorResponse } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin.ok) return authErrorResponse(admin);

  try {
    const { searchParams } = new URL(req.url);
    let query = getAdminClient()
      .from("weekly_plans")
      .select("*")
      .order("week_number", { ascending: true })
      .order("grade", { ascending: true })
      .order("subject", { ascending: true });

    const grade = searchParams.get("grade");
    const subject = searchParams.get("subject");
    const week = searchParams.get("week");
    const status = searchParams.get("status");

    if (grade) query = query.eq("grade", Number(grade));
    if (subject) query = query.eq("subject", subject);
    if (week) query = query.eq("week_number", Number(week));
    if (status) query = query.eq("status", status);

    const { data, error } = await query.limit(300);
    if (error) throw error;

    return NextResponse.json({ success: true, data: data ?? [] });
  } catch (err) {
    console.error("admin weekly plans list failed", err);
    return NextResponse.json(
      { success: false, error: "تعذر تحميل الخطط الأسبوعية" },
      { status: 500 }
    );
  }
}
