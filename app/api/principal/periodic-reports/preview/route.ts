import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { buildPeriodicReport } from "@/lib/reports/periodic-report";
import { requireUserRole } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const schema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  subject: z.string().optional().nullable(),
  grade: z.coerce.number().int().min(1).max(12).optional().nullable(),
  principalName: z.string().optional().nullable(),
  showStudentNames: z.coerce.boolean().default(false),
  includeImprovementPlan: z.coerce.boolean().default(true),
  includeRecommendations: z.coerce.boolean().default(true),
  reportType: z.enum(["learning_outcomes_followup", "nafs_readiness", "learning_outcomes_improvement", "subject_results_analysis"]),
}).refine((value) => value.from <= value.to, { message: "تاريخ البداية يجب أن يكون قبل تاريخ النهاية" });

export async function GET(req: NextRequest) {
  const auth = await requireUserRole(req, ["admin", "principal", "supervisor"]);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const params = Object.fromEntries(new URL(req.url).searchParams.entries());
    const parsed = schema.safeParse(params);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "يرجى إدخال بيانات التقرير بشكل صحيح" }, { status: 400 });
    }

    const report = await buildPeriodicReport(auth.profile, parsed.data);
    return NextResponse.json(
      { success: true, data: report },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
    );
  } catch (err) {
    console.error("periodic report preview failed", err);
    return NextResponse.json({ success: false, error: "تعذر إنشاء معاينة التقرير" }, { status: 500 });
  }
}
