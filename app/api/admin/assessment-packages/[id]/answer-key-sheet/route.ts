import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase-admin";
import { requireAdmin, authErrorResponse } from "@/lib/auth";
import { MAX_SHEET_QUESTIONS } from "@/lib/omr/standard-sheet";

export const dynamic = "force-dynamic";

const OPTION = z.enum(["أ", "ب", "ج", "د"]);
const bodySchema = z.object({
  answers: z.record(z.string().regex(/^q\d{1,2}$/), OPTION),
});

/**
 * Sets a test's answer key from a model answer sheet that was shaded and read on the admin's device.
 * Existing questions keep their skills, domains and notes — only the correct option changes.
 * Missing question numbers are added with a placeholder text. Nothing is deleted.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return authErrorResponse(auth);

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "كل سؤال يجب أن تكون إجابته أ أو ب أو ج أو د" }, { status: 400 });
  }
  const numbers = Object.keys(parsed.data.answers).map((key) => Number(key.slice(1))).sort((a, b) => a - b);
  const count = numbers.length;
  if (!count || count > MAX_SHEET_QUESTIONS || numbers.some((n, i) => n !== i + 1)) {
    return NextResponse.json({ success: false, error: "الأسئلة يجب أن تكون متتالية من 1" }, { status: 400 });
  }

  try {
    const db = getAdminClient();
    const { data: pkg, error: pkgError } = await db.from("assessment_packages").select("id").eq("id", params.id).maybeSingle();
    if (pkgError) throw pkgError;
    if (!pkg) return NextResponse.json({ success: false, error: "لم يتم العثور على حزمة الاختبار" }, { status: 404 });

    const [{ data: existing, error: existingError }, { count: resultsCount, error: resultsError }] = await Promise.all([
      db.from("package_questions").select("id, question_number, correct_option").eq("package_id", params.id),
      db.from("student_package_results").select("id", { count: "exact", head: true }).eq("package_id", params.id),
    ]);
    if (existingError) throw existingError;
    if (resultsError) throw resultsError;

    const byNumber = new Map(((existing ?? []) as Array<{ id: string; question_number: number; correct_option: string }>).map((q) => [q.question_number, q]));
    let updated = 0;
    let unchanged = 0;
    const toInsert: Array<Record<string, unknown>> = [];

    for (const number of numbers) {
      const option = parsed.data.answers[`q${number}`];
      const current = byNumber.get(number);
      if (!current) {
        toInsert.push({
          package_id: params.id,
          question_number: number,
          correct_option: option,
          difficulty_level: "medium",
          points: 1,
          question_text: `سؤال رقم ${number} - راجع ملف PDF`,
          options_json: {},
        });
      } else if (current.correct_option !== option) {
        const { error } = await db.from("package_questions").update({ correct_option: option }).eq("id", current.id);
        if (error) throw error;
        updated++;
      } else {
        unchanged++;
      }
    }

    if (toInsert.length) {
      const { error } = await db.from("package_questions").insert(toInsert);
      if (error) throw error;
    }

    const extra = Array.from(byNumber.keys()).filter((n) => n > count).length;
    return NextResponse.json({
      success: true,
      summary: { count, updated, unchanged, inserted: toInsert.length, extraExisting: extra, gradedResults: resultsCount ?? 0 },
    });
  } catch (err) {
    console.error("answer key from sheet failed", err);
    return NextResponse.json({ success: false, error: "تعذر حفظ مفتاح الإجابة" }, { status: 500 });
  }
}
