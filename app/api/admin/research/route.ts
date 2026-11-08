import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase-admin";
import { requireAdmin, authErrorResponse } from "@/lib/auth";
import { RESEARCH_CONSENT_VERSION, RESEARCH_MIN_CELL, researchExportEnabled } from "@/lib/research";

export const dynamic = "force-dynamic";

const one = <T,>(value: T | T[] | null | undefined) => (Array.isArray(value) ? value[0] : value) ?? null;

/** Research participation overview for the admin panel: who opted in, parent exclusions, export log. */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return authErrorResponse(auth);

  try {
    const db = getAdminClient();
    const [schoolsRes, optOutRes, eventsRes, exportsRes] = await Promise.all([
      db.from("schools").select("id, name, kind, stage, research_consent, research_consent_version, research_consent_updated_at"),
      db.from("students").select("id", { count: "exact", head: true }).eq("research_opt_out", true),
      db
        .from("research_consent_events")
        .select("granted, version, source, created_at, schools(name), users(name)")
        .order("created_at", { ascending: false })
        .limit(30),
      db
        .from("research_exports")
        .select("created_at, consent_version, schools_count, students_count, response_rows, suppressed_classes, users(name)")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    for (const res of [schoolsRes, optOutRes, eventsRes, exportsRes]) if (res.error) throw res.error;

    const schools = schoolsRes.data ?? [];
    const participating = schools.filter((s) => s.research_consent && s.research_consent_version === RESEARCH_CONSENT_VERSION);
    const outdated = schools.filter((s) => s.research_consent && s.research_consent_version !== RESEARCH_CONSENT_VERSION);

    return NextResponse.json({
      success: true,
      data: {
        currentVersion: RESEARCH_CONSENT_VERSION,
        minCell: RESEARCH_MIN_CELL,
        exportEnabled: researchExportEnabled(),
        totals: {
          schools: schools.length,
          participating: participating.length,
          outdated: outdated.length,
          optedOutStudents: optOutRes.count ?? 0,
        },
        participating: participating
          .map((s) => ({ name: s.name, kind: s.kind, stage: s.stage, since: s.research_consent_updated_at }))
          .sort((a, b) => String(b.since).localeCompare(String(a.since))),
        events: (eventsRes.data ?? []).map((e) => ({
          at: e.created_at,
          granted: e.granted,
          source: e.source,
          version: e.version,
          school: one(e.schools as { name: string | null } | { name: string | null }[] | null)?.name ?? "—",
          by: one(e.users as { name: string | null } | { name: string | null }[] | null)?.name ?? null,
        })),
        exports: (exportsRes.data ?? []).map((x) => ({
          at: x.created_at,
          version: x.consent_version,
          schools: x.schools_count,
          students: x.students_count,
          rows: x.response_rows,
          suppressedClasses: x.suppressed_classes,
          by: one(x.users as { name: string | null } | { name: string | null }[] | null)?.name ?? null,
        })),
      },
    });
  } catch (err) {
    console.error("admin research overview failed", err);
    return NextResponse.json({ success: false, error: "تعذر تحميل بيانات البحث" }, { status: 500 });
  }
}
