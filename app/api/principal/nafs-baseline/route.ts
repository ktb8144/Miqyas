import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase-admin";
import { requireUserRole, authErrorResponse } from "@/lib/auth";
import { baselineSchema, fromRow, type NafsBaselineRow } from "@/lib/nafs/baseline";

export const dynamic = "force-dynamic";

const SELECT = "year, grade, subject, overall_percent, mastery_percent, tested_count, absent_count, domains";

function missingTable(error: { code?: string; message?: string } | null) {
  return Boolean(error && (error.code === "42P01" || error.code === "PGRST205" || /nafs_baselines/.test(error.message ?? "")));
}

const NOT_READY = "حفظ نتائج نافس السابقة غير مفعّل بعد في قاعدة البيانات. تواصل مع فريق دالة.";

/** The school's previous NAFS results (principal only). */
export async function GET(req: NextRequest) {
  const auth = await requireUserRole(req, ["principal"]);
  if (!auth.ok) return authErrorResponse(auth);
  const schoolId = auth.profile.school_id;
  if (!schoolId) return NextResponse.json({ success: false, error: "حسابك غير مرتبط بمدرسة" }, { status: 400 });

  const db = getAdminClient();
  const [{ data, error }, { data: school }] = await Promise.all([
    db.from("nafs_baselines").select(SELECT).eq("school_id", schoolId).order("year", { ascending: false }),
    db.from("schools").select("name").eq("id", schoolId).maybeSingle(),
  ]);
  if (error) {
    if (missingTable(error)) return NextResponse.json({ success: false, error: NOT_READY }, { status: 503 });
    console.error("nafs baseline read failed", error);
    return NextResponse.json({ success: false, error: "تعذر تحميل نتائج نافس" }, { status: 500 });
  }
  return NextResponse.json({
    success: true,
    schoolName: (school as { name?: string | null } | null)?.name ?? "",
    baselines: ((data ?? []) as NafsBaselineRow[]).map(fromRow),
  });
}

const saveSchema = z.object({ baselines: z.array(baselineSchema).min(1).max(30) });

/** Saves (replaces) the rows sent — one per year × grade × subject. */
export async function PUT(req: NextRequest) {
  const auth = await requireUserRole(req, ["principal"]);
  if (!auth.ok) return authErrorResponse(auth);
  const schoolId = auth.profile.school_id;
  if (!schoolId) return NextResponse.json({ success: false, error: "حسابك غير مرتبط بمدرسة" }, { status: 400 });

  const parsed = saveSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "تحقق من القيم: النسب بين 0 و100، والأعداد صحيحة" }, { status: 400 });
  }

  const rows = parsed.data.baselines.map((b) => ({
    school_id: schoolId,
    year: b.year,
    grade: b.grade,
    subject: b.subject,
    overall_percent: b.overallPercent,
    mastery_percent: b.masteryPercent,
    tested_count: b.testedCount,
    absent_count: b.absentCount,
    domains: b.domains,
    created_by: auth.profile.id,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await getAdminClient()
    .from("nafs_baselines")
    .upsert(rows, { onConflict: "school_id,year,grade,subject" });
  if (error) {
    if (missingTable(error)) return NextResponse.json({ success: false, error: NOT_READY }, { status: 503 });
    console.error("nafs baseline save failed", error);
    return NextResponse.json({ success: false, error: "تعذر حفظ نتائج نافس" }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
