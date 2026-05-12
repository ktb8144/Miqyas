import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase-admin";
import { hashParentReportToken } from "@/lib/parent-report";

export const dynamic = "force-dynamic";

const schema = z.object({
  token: z.string().trim().min(20),
  score: z.coerce.number().int().min(0),
  totalQuestions: z.coerce.number().int().min(1).max(50),
  skillName: z.string().trim().min(1).max(180),
  eventType: z.enum(["mission_completed", "subscription_interest"]).optional().default("mission_completed"),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "بيانات التدريب غير مكتملة" }, { status: 400 });
    }

    const { token, score, totalQuestions, skillName, eventType } = parsed.data;
    const db = getAdminClient();
    const now = new Date().toISOString();
    const { data: tokenRow, error: tokenError } = await db
      .from("parent_report_tokens")
      .select("id, expires_at, revoked_at")
      .eq("token_hash", hashParentReportToken(token))
      .gt("expires_at", now)
      .is("revoked_at", null)
      .maybeSingle();

    if (tokenError) throw tokenError;
    if (!tokenRow) {
      return NextResponse.json({ success: false, error: "رابط التدريب غير صالح أو منتهي" }, { status: 404 });
    }

    const { data: eventRow, error: insertError } = await db
      .from("parent_report_events")
      .insert({
        token_id: tokenRow.id,
        event_type: eventType,
        metadata: {
          score: Math.min(score, totalQuestions),
          total_questions: totalQuestions,
          skill_name: skillName,
          ...(eventType === "subscription_interest" ? { source: "student_mission_result" } : {}),
        },
      })
      .select("id")
      .single();

    if (insertError) throw insertError;

    return NextResponse.json({ success: true, eventId: eventRow?.id ?? null });
  } catch (err) {
    console.error("mission completed event failed", err);
    return NextResponse.json({ success: false, error: "تعذر حفظ إكمال التدريب" }, { status: 500 });
  }
}
