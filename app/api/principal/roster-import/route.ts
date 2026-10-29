import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase-admin";
import { requireUserRole, authErrorResponse } from "@/lib/auth";
import { normalizeSubject } from "@/lib/subjects";
import { addStudentsToClass } from "@/lib/students/save";

export const dynamic = "force-dynamic";

const SUBJECTS = ["رياضيات", "لغة عربية", "علوم"] as const;

const importSchema = z.object({
  classes: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(60),
        grade: z.number().int().min(1).max(12),
        subject: z.string().trim().min(1).max(40),
        teacherId: z.string().uuid(),
        names: z.array(z.string().trim().min(1).max(120)).min(1).max(80),
      })
    )
    .min(1)
    .max(30),
});

/**
 * Principal imports a Noor class list: one entry per (section × subject teacher).
 * Creates the class for that teacher if it does not exist, then adds the students in list order.
 * Only names reach the server; the file itself is read in the browser.
 */
export async function POST(req: NextRequest) {
  const auth = await requireUserRole(req, ["principal"]);
  if (!auth.ok) return authErrorResponse(auth);

  try {
    const schoolId = auth.profile.school_id;
    if (!schoolId) {
      return NextResponse.json({ success: false, error: "حسابك غير مرتبط بمدرسة" }, { status: 400 });
    }

    const parsed = importSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "تحقق من الفصول والمعلمين والأسماء" }, { status: 400 });
    }

    const entries = parsed.data.classes.map((entry) => ({ ...entry, subject: normalizeSubject(entry.subject) }));
    if (entries.some((entry) => !(SUBJECTS as readonly string[]).includes(entry.subject))) {
      return NextResponse.json({ success: false, error: "المادة يجب أن تكون رياضيات أو لغة عربية أو علوم" }, { status: 400 });
    }

    const db = getAdminClient();
    const teacherIds = Array.from(new Set(entries.map((entry) => entry.teacherId)));
    const { data: teachers, error: teachersError } = await db
      .from("users")
      .select("id")
      .in("id", teacherIds)
      .eq("school_id", schoolId)
      .eq("role", "teacher");
    if (teachersError) throw teachersError;
    if ((teachers ?? []).length !== teacherIds.length) {
      return NextResponse.json({ success: false, error: "أحد المعلمين المختارين ليس من مدرستك" }, { status: 403 });
    }

    const summary: Array<{ className: string; subject: string; created: boolean; added: number; duplicates: number }> = [];
    for (const entry of entries) {
      const { data: existing, error: existingError } = await db
        .from("classes")
        .select("id")
        .eq("school_id", schoolId)
        .eq("teacher_id", entry.teacherId)
        .eq("subject", entry.subject)
        .eq("name", entry.name)
        .limit(1)
        .maybeSingle();
      if (existingError) throw existingError;

      let classId = (existing as { id: string } | null)?.id;
      const created = !classId;
      if (!classId) {
        const { data: inserted, error: insertError } = await db
          .from("classes")
          .insert({ name: entry.name, grade: entry.grade, subject: entry.subject, teacher_id: entry.teacherId, school_id: schoolId })
          .select("id")
          .single();
        if (insertError) throw insertError;
        classId = (inserted as { id: string }).id;
      }

      const saved = await addStudentsToClass({ schoolId, classId, names: entry.names });
      summary.push({ className: entry.name, subject: entry.subject, created, added: saved.added, duplicates: saved.duplicates });
    }

    return NextResponse.json({ success: true, summary });
  } catch (err) {
    console.error("roster import failed", err);
    return NextResponse.json({ success: false, error: "تعذر استيراد الكشف حاليًا" }, { status: 500 });
  }
}
