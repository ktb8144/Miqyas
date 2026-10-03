import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase-admin";
import { requireUserRole, authErrorResponse } from "@/lib/auth";
import { cleanName, normalizeName } from "@/lib/format";

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

    const cleanedNames = names.map(cleanName).filter(Boolean);
    const uniqueNames: string[] = [];
    const incomingSeen = new Set<string>();

    cleanedNames.forEach((name) => {
      const key = normalizeName(name);
      if (!incomingSeen.has(key)) {
        incomingSeen.add(key);
        uniqueNames.push(name);
      }
    });

    const { data: existingRows, error: existingError } = await db
      .from("students")
      .select("name, student_code")
      .eq("class_id", classId)
      .eq("school_id", auth.profile.school_id);

    if (existingError) {
      console.error("save students existing lookup failed", existingError);
      return NextResponse.json(
        { success: false, error: "تعذر فحص الطلاب الحاليين" },
        { status: 500 }
      );
    }

    const existingNames = new Set((existingRows ?? []).map((row) => normalizeName(row.name)));
    const existingCodes = new Set(
      (existingRows ?? [])
        .map((row) => Number(String(row.student_code ?? "").replace(/^0+/, "")))
        .filter((value) => Number.isInteger(value) && value > 0)
    );
    const namesToInsert = uniqueNames.filter((name) => !existingNames.has(normalizeName(name)));

    if (namesToInsert.length === 0) {
      return NextResponse.json({
        success: true,
        students: [],
        insertedCount: 0,
        added: 0,
        duplicates: cleanedNames.length,
      });
    }

    let nextCode = 1;
    const rows = namesToInsert.map((name) => {
      while (existingCodes.has(nextCode)) nextCode += 1;
      const studentCode = String(nextCode);
      existingCodes.add(nextCode);
      nextCode += 1;
      return {
        name,
        school_id: auth.profile.school_id,
        class_id: classId,
        student_number: null,
        student_code: studentCode,
        score: 0,
        total: 10,
      };
    });

    const { data: students, error: insertError } = await db
      .from("students")
      .insert(rows)
      .select("id, name, class_id, school_id, student_number, student_code, score, total, created_at");

    if (insertError) {
      console.error("save students insert failed", {
        code: insertError.code,
        message: insertError.message,
      });
      return NextResponse.json(
        { success: false, error: "تعذر حفظ الطلاب في قاعدة البيانات" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      students: students ?? [],
      insertedCount: students?.length ?? 0,
      added: students?.length ?? 0,
      duplicates: cleanedNames.length - (students?.length ?? 0),
    });
  } catch (err) {
    console.error("save students failed", err);
    return NextResponse.json(
      { success: false, error: "تعذر حفظ الطلاب حاليًا" },
      { status: 500 }
    );
  }
}
