import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { buildPeriodicReport, renderPeriodicReportHtml } from "@/lib/reports/periodic-report";
import { requireUserRole } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const booleanParam = z.union([z.boolean(), z.enum(["true", "false"])]).transform((value) => value === true || value === "true");

const schema = z.object({
  weekNumber: z.coerce.number().int().min(1).max(60).optional().nullable(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  subject: z.string().optional().nullable(),
  grade: z.coerce.number().int().min(1).max(12).optional().nullable(),
  educationRegion: z.string().optional().nullable(),
  principalName: z.string().optional().nullable(),
  showStudentNames: booleanParam.default(false),
  includeImprovementPlan: booleanParam.default(true),
  includeRecommendations: booleanParam.default(true),
  reportType: z.enum(["learning_outcomes_followup", "nafs_readiness", "learning_outcomes_improvement", "subject_results_analysis"]),
}).refine((value) => value.weekNumber || (value.from && value.to), { message: "اختر الأسبوع أو الفترة" })
  .refine((value) => !value.from || !value.to || value.from <= value.to, { message: "تاريخ البداية يجب أن يكون قبل تاريخ النهاية" });

export async function POST(req: NextRequest) {
  const auth = await requireUserRole(req, ["admin", "principal", "supervisor"]);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "يرجى إدخال بيانات التقرير بشكل صحيح" }, { status: 400 });
    }

    const report = await buildPeriodicReport(auth.profile, parsed.data);
    const html = renderPeriodicReportHtml(report);
    const schoolName = String(report.school?.name ?? "المدرسة")
      .trim()
      .replace(/\s+/g, "_")
      .replace(/[\\/:*?"<>|]+/g, "");
    const week = report.period.weekNumber ? String(report.period.weekNumber) : "دوري";
    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(`تقرير_نواتج_التعلم_${schoolName}_الأسبوع_${week}.html`)}`,
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (err) {
    console.error("periodic report export failed", err);
    return NextResponse.json({ success: false, error: "تعذر تصدير التقرير" }, { status: 500 });
  }
}
