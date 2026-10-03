import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authErrorResponse, requireUserRole } from "@/lib/auth";
import { errorJson, logDbError } from "@/lib/api";
import { buildStudentProfile, loadStudentForViewer } from "@/lib/students/profile";

export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireUserRole(req, ["admin", "principal", "supervisor", "teacher"]);
  if (!auth.ok) return authErrorResponse(auth);

  if (!z.string().uuid().safeParse(params.id).success) {
    return errorJson("الطالب غير موجود", 404);
  }

  try {
    // Same 404 whether the student doesn't exist or belongs to someone else's class/school.
    const student = await loadStudentForViewer(params.id, auth.profile);
    if (!student) return errorJson("الطالب غير موجود", 404);

    const profile = await buildStudentProfile(student);
    return NextResponse.json({ success: true, data: profile }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    logDbError("student profile", err);
    return errorJson("تعذر تحميل ملف الطالب");
  }
}
