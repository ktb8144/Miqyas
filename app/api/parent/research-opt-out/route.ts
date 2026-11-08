import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase-admin";
import { hashParentReportToken } from "@/lib/parent-report";

export const dynamic = "force-dynamic";

const schema = z.object({
  token: z.string().trim().min(20).max(200),
  optOut: z.boolean(),
});

/** A parent excludes (or re-includes) their child from research exports, using the report link they hold. */
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, error: "طلب غير صالح" }, { status: 400 });

  try {
    const db = getAdminClient();
    const { data: tokenRow, error: tokenError } = await db
      .from("parent_report_tokens")
      .select("student_id")
      .eq("token_hash", hashParentReportToken(parsed.data.token))
      .gt("expires_at", new Date().toISOString())
      .is("revoked_at", null)
      .maybeSingle();
    if (tokenError) throw tokenError;
    if (!tokenRow?.student_id) {
      return NextResponse.json({ success: false, error: "رابط التقرير غير صالح أو منتهي" }, { status: 404 });
    }

    const { error } = await db.rpc("set_research_opt_out", {
      p_student: tokenRow.student_id,
      p_opted_out: parsed.data.optOut,
      p_source: "parent_report",
    });
    if (error) throw error;

    return NextResponse.json({ success: true, optedOut: parsed.data.optOut });
  } catch (err) {
    console.error("research opt-out failed", err);
    return NextResponse.json({ success: false, error: "تعذر حفظ اختيارك. حاول مرة أخرى." }, { status: 500 });
  }
}
