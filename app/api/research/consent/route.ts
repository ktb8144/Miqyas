import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase-admin";
import { requireUserRole, authErrorResponse, type AppProfile } from "@/lib/auth";
import { RESEARCH_CONSENT_VERSION, consentState } from "@/lib/research";

export const dynamic = "force-dynamic";

/** Who decides for a school: its principal, or an independent teacher for their own account. */
async function loadSchool(profile: AppProfile) {
  if (!profile.school_id) return null;
  const { data, error } = await getAdminClient()
    .from("schools")
    .select("id, kind, research_consent, research_consent_version, research_consent_updated_at")
    .eq("id", profile.school_id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const canManage =
    (profile.role === "principal" && data.kind === "school") ||
    (profile.role === "teacher" && data.kind === "individual");
  return { school: data, canManage };
}

export async function GET(req: NextRequest) {
  const auth = await requireUserRole(req, ["principal", "teacher"]);
  if (!auth.ok) return authErrorResponse(auth);
  try {
    const found = await loadSchool(auth.profile);
    if (!found) return NextResponse.json({ success: true, canManage: false });
    return NextResponse.json({
      success: true,
      canManage: found.canManage,
      kind: found.school.kind,
      currentVersion: RESEARCH_CONSENT_VERSION,
      ...consentState(found.school),
    });
  } catch (err) {
    console.error("research consent load failed", err);
    return NextResponse.json({ success: false, error: "تعذر تحميل حالة المشاركة في البحث" }, { status: 500 });
  }
}

const schema = z.object({ granted: z.boolean() });

export async function POST(req: NextRequest) {
  const auth = await requireUserRole(req, ["principal", "teacher"]);
  if (!auth.ok) return authErrorResponse(auth);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, error: "طلب غير صالح" }, { status: 400 });

  try {
    const found = await loadSchool(auth.profile);
    if (!found?.canManage) {
      return NextResponse.json({ success: false, error: "قرار المشاركة في البحث لقائد المدرسة" }, { status: 403 });
    }
    const db = getAdminClient();
    const { error } = await db.rpc("set_research_consent", {
      p_school: found.school.id,
      p_user: auth.profile.id,
      p_granted: parsed.data.granted,
      p_version: RESEARCH_CONSENT_VERSION,
      p_source: "settings",
    });
    if (error) throw error;
    const { data } = await db
      .from("schools")
      .select("research_consent, research_consent_version, research_consent_updated_at")
      .eq("id", found.school.id)
      .maybeSingle();
    return NextResponse.json({ success: true, currentVersion: RESEARCH_CONSENT_VERSION, ...consentState(data) });
  } catch (err) {
    console.error("research consent update failed", err);
    return NextResponse.json({ success: false, error: "تعذر حفظ قرارك. حاول مرة أخرى." }, { status: 500 });
  }
}
