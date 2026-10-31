import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase-admin";
import { requireUserRole, authErrorResponse } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * The test's question PDF, served from our own origin so the browser can read it (stamp each class's
 * copy, read the master layout) without depending on storage CORS. Only the assigned teacher, and only
 * files in this project's storage.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUserRole(req, ["teacher"]);
  if (!auth.ok) return authErrorResponse(auth);

  const schoolId = auth.profile.school_id;
  if (!schoolId) return NextResponse.json({ success: false, error: "حساب المعلم غير مرتبط بمدرسة" }, { status: 400 });

  const db = getAdminClient();
  const { data, error } = await db
    .from("class_package_assignments")
    .select("id, assessment_packages(student_pdf_url)")
    .eq("id", params.id)
    .eq("school_id", schoolId)
    .eq("teacher_id", auth.profile.id)
    .maybeSingle();
  if (error) return NextResponse.json({ success: false, error: "تعذّر تحميل ورقة الأسئلة" }, { status: 500 });

  const url = (data as { assessment_packages?: { student_pdf_url?: string | null } | null } | null)?.assessment_packages?.student_pdf_url;
  if (!url) return NextResponse.json({ success: false, error: "لا توجد ورقة أسئلة لهذا الاختبار" }, { status: 404 });

  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
  const storage = `${base}/storage/v1/object/`;
  if (!base || !url.startsWith(storage)) return NextResponse.json({ success: false, error: "رابط ورقة الأسئلة غير مدعوم" }, { status: 400 });

  const upstream = await fetch(url, { cache: "no-store" });
  if (!upstream.ok || !upstream.body) return NextResponse.json({ success: false, error: "تعذّر تحميل ورقة الأسئلة" }, { status: 502 });

  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": "application/pdf",
      "Cache-Control": "private, max-age=300",
    },
  });
}
