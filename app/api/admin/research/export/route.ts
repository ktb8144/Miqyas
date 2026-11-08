import { NextRequest, NextResponse } from "next/server";
import { strToU8, zipSync } from "fflate";
import { getAdminClient } from "@/lib/supabase-admin";
import { requireAdmin, authErrorResponse } from "@/lib/auth";
import { RESEARCH_CONSENT_VERSION, RESEARCH_MIN_CELL, researchExportEnabled } from "@/lib/research";
import { buildResearchFiles, type ResearchNafsRow, type ResearchResponseRow, type ResearchSchool } from "@/lib/research-export";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const PAGE = 1000;

/**
 * De-identified research export (ZIP of CSV files). Locked until RESEARCH_EXPORT_ENABLED=true is set in
 * the deployment, which should happen only after ethics and Ministry approvals. Every export is logged.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return authErrorResponse(auth);
  if (!researchExportEnabled()) {
    return NextResponse.json(
      { success: false, error: "التصدير البحثي مقفل حتى تصدر موافقة لجنة الأخلاقيات ووزارة التعليم (RESEARCH_EXPORT_ENABLED)." },
      { status: 403 }
    );
  }

  try {
    const db = getAdminClient();

    const { data: schools, error: schoolsError } = await db
      .from("schools")
      .select("id, kind, stage, gender")
      .eq("research_consent", true)
      .eq("research_consent_version", RESEARCH_CONSENT_VERSION);
    if (schoolsError) throw schoolsError;
    const schoolIds = (schools ?? []).map((s) => s.id);

    const responses: ResearchResponseRow[] = [];
    for (let from = 0; schoolIds.length > 0; from += PAGE) {
      const { data, error } = await db
        .rpc("research_responses", { p_version: RESEARCH_CONSENT_VERSION })
        .range(from, from + PAGE - 1);
      if (error) throw error;
      const batch = (data ?? []) as ResearchResponseRow[];
      responses.push(...batch);
      if (batch.length < PAGE) break;
    }

    const nafs: ResearchNafsRow[] = [];
    if (schoolIds.length > 0) {
      const { data, error } = await db
        .from("nafs_baselines")
        .select("school_id, year, grade, subject, overall_percent, mastery_percent, tested_count, domains")
        .in("school_id", schoolIds);
      if (error) throw error;
      nafs.push(...((data ?? []) as ResearchNafsRow[]));
    }

    const exportedOn = new Date().toISOString().slice(0, 10);
    const { files, stats } = buildResearchFiles({
      responses,
      schools: (schools ?? []) as ResearchSchool[],
      nafs,
      minCell: RESEARCH_MIN_CELL,
      consentVersion: RESEARCH_CONSENT_VERSION,
      exportedOn,
    });

    const { error: logError } = await db.from("research_exports").insert({
      admin_id: auth.profile.id,
      consent_version: RESEARCH_CONSENT_VERSION,
      schools_count: stats.schools,
      students_count: stats.students,
      response_rows: stats.responseRows,
      suppressed_classes: stats.suppressedClasses,
    });
    // No log, no export.
    if (logError) throw logError;

    const zip = zipSync(Object.fromEntries(Object.entries(files).map(([name, text]) => [name, strToU8(text)])));
    return new NextResponse(Buffer.from(zip), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="dala-research-${exportedOn}.zip"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("research export failed", err);
    return NextResponse.json({ success: false, error: "تعذر إنشاء الملف البحثي" }, { status: 500 });
  }
}
