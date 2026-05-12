import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { getAdminClient, requireUserRole } from "@/lib/supabase-admin";
import { hashParentReportToken } from "@/lib/parent-report";

export const dynamic = "force-dynamic";

const createTokenSchema = z.object({
  studentId: z.string().uuid(),
});

function appUrl(req: NextRequest) {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  return req.nextUrl.origin;
}

export async function POST(req: NextRequest) {
  const auth = await requireUserRole(req, ["admin", "principal", "supervisor", "teacher"]);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const parsed = createTokenSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "يرجى اختيار طالب صحيح" }, { status: 400 });
    }

    const db = getAdminClient();
    const { data: student, error: studentError } = await db
      .from("students")
      .select("id, school_id, class_id, name, classes(id, teacher_id, school_id)")
      .eq("id", parsed.data.studentId)
      .maybeSingle();

    if (studentError) throw studentError;
    if (!student) {
      return NextResponse.json({ success: false, error: "لم يتم العثور على الطالب" }, { status: 404 });
    }

    const classRow = Array.isArray(student.classes) ? student.classes[0] : student.classes;
    const sameSchool = auth.profile.role === "admin" || auth.profile.school_id === student.school_id;
    const ownsClass = auth.profile.role !== "teacher" || classRow?.teacher_id === auth.profile.id;

    if (!sameSchool || !ownsClass) {
      console.warn("parent report token denied", {
        role: auth.profile.role,
        requesterSchoolId: auth.profile.school_id,
        studentSchoolId: student.school_id,
        studentId: student.id,
      });
      return NextResponse.json({ success: false, error: "ليست لديك صلاحية لإنشاء رابط لهذا الطالب" }, { status: 403 });
    }

    const token = crypto.randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const { error: insertError } = await db
      .from("parent_report_tokens")
      .insert({
        token_hash: hashParentReportToken(token),
        student_id: student.id,
        school_id: student.school_id,
        class_id: student.class_id,
        created_by: auth.profile.id,
        expires_at: expiresAt,
      });

    if (insertError) throw insertError;

    return NextResponse.json({
      success: true,
      token,
      url: `${appUrl(req)}/parent/report/${token}`,
      expiresAt,
      student: {
        name: student.name,
      },
    });
  } catch (err) {
    console.error("create parent report token failed", err);
    return NextResponse.json({ success: false, error: "تعذر إنشاء رابط تقرير ولي الأمر" }, { status: 500 });
  }
}
