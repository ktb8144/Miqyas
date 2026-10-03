import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { extractStudentNames } from "@/lib/gemini";
import { requireUserRole, authErrorResponse } from "@/lib/auth";

const extractNamesSchema = z.object({
  imageBase64: z.string().min(100),
  mimeType: z.string().trim().min(1).default("image/jpeg"),
});

export async function POST(req: NextRequest) {
  try {
    const auth = await requireUserRole(req, ["principal", "teacher"]);
    if (!auth.ok) return authErrorResponse(auth);

    const parsed = extractNamesSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "يرجى إرفاق صورة واضحة للكشف" }, { status: 400 });
    }

    const { imageBase64, mimeType } = parsed.data;
    const names = await extractStudentNames(imageBase64, mimeType);
    return NextResponse.json({ success: true, names });
  } catch (err) {
    console.error("extract names failed", err);
    return NextResponse.json({ success: false, error: "تعذر استخراج الأسماء حاليًا" }, { status: 500 });
  }
}
