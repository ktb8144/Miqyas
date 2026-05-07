import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateQuestions } from "@/lib/gemini";
import { requireUserRole } from "@/lib/supabase-admin";

const generateQuestionsSchema = z.object({
  grade: z.string().trim().min(1),
  subject: z.string().trim().min(1),
  skill: z.string().trim().min(1),
  bloomLevel: z.string().trim().min(1).default("التطبيق"),
  count: z.coerce.number().int().min(1).max(30).default(10),
});

export async function POST(req: NextRequest) {
  try {
    const auth = await requireUserRole(req, ["admin", "principal", "teacher"]);
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const parsed = generateQuestionsSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "تحقق من بيانات السؤال المطلوبة" }, { status: 400 });
    }

    const { grade, subject, skill, bloomLevel, count } = parsed.data;
    const questions = await generateQuestions(grade, subject, skill, bloomLevel, count);
    return NextResponse.json({ success: true, questions });
  } catch (err) {
    console.error("generate questions failed", err);
    return NextResponse.json({ success: false, error: "تعذر توليد الأسئلة حاليًا" }, { status: 500 });
  }
}
