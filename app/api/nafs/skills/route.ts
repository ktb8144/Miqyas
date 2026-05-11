import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, requireUserRole } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

function parseGrade(value: string | null) {
  if (!value) return null;
  const grade = Number(value);
  return Number.isInteger(grade) ? grade : null;
}

export async function GET(req: NextRequest) {
  const auth = await requireUserRole(req, ["admin", "principal", "teacher"]);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(req.url);
    const subject = searchParams.get("subject")?.trim();
    const grade = parseGrade(searchParams.get("grade"));
    const domainId = searchParams.get("domainId")?.trim();
    const status = auth.profile.role === "admin" ? searchParams.get("status")?.trim() : "active";

    let query = getAdminClient()
      .from("learning_skills")
      .select(`
        id,
        nafs_domain_id,
        subject,
        grade,
        skill_code,
        skill_name,
        skill_description,
        difficulty_level,
        nafs_weight,
        remediation_summary,
        status,
        nafs_domains(domain_code, domain_name)
      `)
      .order("grade", { ascending: true })
      .order("subject", { ascending: true })
      .order("skill_code", { ascending: true });

    if (subject) query = query.eq("subject", subject);
    if (grade) query = query.eq("grade", grade);
    if (domainId) query = query.eq("nafs_domain_id", domainId);
    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, skills: data ?? [] });
  } catch (err) {
    console.error("nafs skills list failed", err);
    return NextResponse.json(
      { success: false, error: "تعذر تحميل مهارات نافس" },
      { status: 500 }
    );
  }
}
