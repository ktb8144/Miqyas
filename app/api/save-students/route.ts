import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase-admin";
import { requireUserRole, authErrorResponse } from "@/lib/auth";
import { addStudentsToClass } from "@/lib/students/save";

const saveStudentsSchema = z.object({
  classId: z.string().uuid(),
  names: z.array(z.string().trim().min(1).max(120)).min(1).max(200),
});

export async function POST(req: NextRequest) {
  try {
    const auth = await requireUserRole(req, ["teacher"]);
    if (!auth.ok) return authErrorResponse(auth);

    const parsed = saveStudentsSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "تحقق من الفصل وأسماء الطلاب" },
        { status: 400 }
      );
    }

    const { classId, names } = parsed.data;
    const db = getAdminClient();

    const { data: classRow, error: classError } = await db
      .from("classes")
      .select("id, school_id, teacher_id")
      .eq("id", classId)
      .eq("teacher_id", auth.profile.id)
      .eq("school_id", auth.profile.school_id)
      .single();

    if (classError || !classRow) {
      console.warn("save students denied", {
        teacher_id: auth.profile.id,
        school_id: auth.profile.school_id,
        class_id: classId,
      });
      return NextResponse.json(
        { success: false, error: "لا يمكنك إضافة طلاب لهذا الفصل" },
        { status: 403 }
      );
    }

    const saved = await addStudentsToClass({ schoolId: classRow.school_id, classId, names });
    return NextResponse.json({
      success: true,
      students: saved.students,
      insertedCount: saved.added,
      added: saved.added,
      duplicates: saved.duplicates,
    });
  } catch (err) {
    console.error("save students failed", err);
    return NextResponse.json(
      { success: false, error: "تعذر حفظ الطلاب حاليًا" },
      { status: 500 }
    );
  }
}
