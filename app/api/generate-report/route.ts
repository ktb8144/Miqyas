import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateClassReport } from "@/lib/gemini";
import { requireUserRole } from "@/lib/supabase-admin";

const reportSchema = z.object({
  teacherName: z.string().trim().min(1),
  skill: z.string().trim().min(1),
  grade: z.string().trim().min(1),
  subject: z.string().trim().min(1),
  results: z.array(z.object({
    name: z.string(),
    score: z.number(),
    total: z.number(),
    level: z.string(),
  })).min(1).max(200),
});

export async function POST(req: NextRequest) {
  try {
    const auth = await requireUserRole(req, ["principal", "teacher"]);
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const parsed = reportSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "تحقق من بيانات التقرير المطلوبة" }, { status: 400 });
    }

    const { teacherName, skill, grade, subject, results } = parsed.data;
    const report = await generateClassReport(teacherName, skill, grade, subject, results);
    return NextResponse.json({ success: true, report });
  } catch (err) {
    console.error("generate report failed", err);
    return NextResponse.json({ success: false, error: "تعذر توليد التقرير حاليًا" }, { status: 500 });
  }
}
