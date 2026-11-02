import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserRole, authErrorResponse } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase-admin";
import { renumberSectionAlphabetically } from "@/lib/students/renumber";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ force: z.boolean().optional() });

/**
 * Renumbers the teacher's class alphabetically (1, 2, 3…), together with the same section in the
 * other subjects so a student keeps one number. Meant for the start of a term, before printing.
 * 409 with the list of printed tests that still have unscanned sheets, unless force is true.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUserRole(req, ["teacher"]);
  if (!auth.ok) return authErrorResponse(auth);
  const schoolId = auth.profile.school_id;
  if (!schoolId) {
    return NextResponse.json({ success: false, error: "حساب المعلم غير مرتبط بمدرسة" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success || !z.string().uuid().safeParse(params.id).success) {
    return NextResponse.json({ success: false, error: "طلب غير صالح" }, { status: 400 });
  }

  try {
    const db = getAdminClient();
    const { data: classRow, error: classError } = await db
      .from("classes")
      .select("id")
      .eq("id", params.id)
      .eq("school_id", schoolId)
      .eq("teacher_id", auth.profile.id)
      .maybeSingle();
    if (classError) throw classError;
    if (!classRow) {
      return NextResponse.json({ success: false, error: "لا يمكنك تعديل هذا الفصل" }, { status: 403 });
    }

    const result = await renumberSectionAlphabetically({ schoolId, classId: params.id, force: parsed.data.force ?? false });
    if (!result.ok) {
      return NextResponse.json(
        {
          success: false,
          error: "يوجد اختبار مطبوع لم تُصحَّح كل أوراقه بعد.",
          pending: result.pending,
        },
        { status: 409 }
      );
    }
    return NextResponse.json({ success: true, changed: result.changed, classIds: result.classIds });
  } catch (err) {
    console.error("renumber students failed", err);
    return NextResponse.json({ success: false, error: "تعذرت إعادة الترقيم حاليًا" }, { status: 500 });
  }
}
