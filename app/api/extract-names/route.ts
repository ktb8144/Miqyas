import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { extractStudentNames } from "@/lib/gemini";
import { requireUserRole, authErrorResponse } from "@/lib/auth";
import { AI_READING_ENABLED } from "@/lib/ai-reading";
import { claudeConfigured } from "@/lib/claude";
import { readNamesWithClaude } from "@/lib/students/read-names";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const extractNamesSchema = z.object({
  imageBase64: z.string().min(100).max(15_000_000),
  mimeType: z.string().trim().min(1).default("image/jpeg"),
});

/**
 * Student names from a photo of a class list. Claude reads it; Gemini is used only when Claude
 * is not available and AI reading was switched on for it (lib/ai-reading.ts).
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireUserRole(req, ["principal", "teacher"]);
    if (!auth.ok) return authErrorResponse(auth);
    const useClaude = claudeConfigured();
    if (!useClaude && !AI_READING_ENABLED) {
      return NextResponse.json(
        { success: false, error: "قراءة الكشوف بالصور متوقفة. ارفع ملف Excel من نور أو الصق الأسماء." },
        { status: 403 }
      );
    }

    const parsed = extractNamesSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "يرجى إرفاق صورة واضحة للكشف" }, { status: 400 });
    }

    const { imageBase64, mimeType } = parsed.data;
    if (useClaude) {
      try {
        const names = await readNamesWithClaude(imageBase64, mimeType, { schoolId: auth.profile.school_id, userId: auth.profile.id });
        return NextResponse.json({ success: true, names });
      } catch (err) {
        console.error("extract names with Claude failed", err);
        if (!AI_READING_ENABLED) throw err;
      }
    }
    const names = await extractStudentNames(imageBase64, mimeType);
    return NextResponse.json({ success: true, names });
  } catch (err) {
    console.error("extract names failed", err);
    return NextResponse.json({ success: false, error: "تعذر استخراج الأسماء حاليًا" }, { status: 500 });
  }
}
