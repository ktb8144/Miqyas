import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateWorksheet } from "@/lib/gemini";
import { requireUserRole } from "@/lib/supabase-admin";

const worksheetSchema = z.object({
  weakSkills: z.array(z.string().trim().min(1)).min(1).max(20),
  unit: z.string().trim().min(1).default("الكسور"),
  grade: z.string().trim().min(1).default("الثالث"),
  subject: z.string().trim().min(1).default("الرياضيات"),
  studentName: z.string().trim().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const auth = await requireUserRole(req, ["principal", "teacher"]);
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const parsed = worksheetSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "تحقق من بيانات ورقة العمل المطلوبة" }, { status: 400 });
    }

    const { weakSkills, unit, grade, subject, studentName } = parsed.data;
    const exercises = await generateWorksheet(
      weakSkills,
      unit,
      grade,
      subject,
      studentName
    );

    return NextResponse.json({ success: true, exercises });
  } catch (err) {
    console.error("generate worksheet failed", err);
    return NextResponse.json({ success: false, error: "تعذر توليد ورقة العمل حاليًا" }, { status: 500 });
  }
}
