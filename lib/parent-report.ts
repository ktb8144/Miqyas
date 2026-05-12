import crypto from "crypto";
import { getAdminClient } from "@/lib/supabase-admin";

export function hashParentReportToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

type QuestionResultRow = {
  is_correct: boolean;
  nafs_domains?: { domain_name?: string | null } | null;
  learning_skills?: { skill_name?: string | null; remediation_summary?: string | null } | null;
};

function pct(value: number | string | null | undefined) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.round(numeric) : 0;
}

export function getWeakestSkill(rows: QuestionResultRow[]) {
  const grouped = new Map<string, { name: string; domain: string; wrong: number; total: number; remediation?: string | null }>();
  rows.forEach((row) => {
    const name = row.learning_skills?.skill_name ?? "مهارة تحتاج متابعة";
    const current = grouped.get(name) ?? {
      name,
      domain: row.nafs_domains?.domain_name ?? "مجال غير محدد",
      wrong: 0,
      total: 0,
      remediation: row.learning_skills?.remediation_summary ?? null,
    };
    current.total += 1;
    if (!row.is_correct) current.wrong += 1;
    grouped.set(name, current);
  });

  return Array.from(grouped.values())
    .filter((item) => item.wrong > 0)
    .sort((a, b) => b.wrong / b.total - a.wrong / a.total)[0] ?? null;
}

export async function loadParentReportData(token: string, eventType?: "open_report" | "open_mission") {
  const db = getAdminClient();
  const now = new Date().toISOString();
  const { data: tokenRow, error: tokenError } = await db
    .from("parent_report_tokens")
    .select("id, student_id, school_id, class_id, expires_at, revoked_at, opened_at, open_count")
    .eq("token_hash", hashParentReportToken(token))
    .gt("expires_at", now)
    .is("revoked_at", null)
    .maybeSingle();

  if (tokenError || !tokenRow) return null;

  if (eventType) {
    await db
      .from("parent_report_tokens")
      .update({
        opened_at: tokenRow.opened_at ?? now,
        last_opened_at: now,
        open_count: Number(tokenRow.open_count ?? 0) + 1,
      })
      .eq("id", tokenRow.id);

    await db
      .from("parent_report_events")
      .insert({
        token_id: tokenRow.id,
        event_type: eventType,
        metadata: {},
      });
  }

  const [studentResult, latestResult] = await Promise.all([
    db
      .from("students")
      .select("id, name, student_code, school_id, class_id, classes(name, grade, subject), schools(name)")
      .eq("id", tokenRow.student_id)
      .eq("school_id", tokenRow.school_id)
      .maybeSingle(),
    db
      .from("student_package_results")
      .select("id, package_id, score, total, percentage, level, scanned_at, created_at, assessment_packages(title, subject, grade, week_number)")
      .eq("student_id", tokenRow.student_id)
      .eq("school_id", tokenRow.school_id)
      .order("scanned_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (studentResult.error || !studentResult.data) return null;

  const result = latestResult.data as unknown as {
    id: string;
    package_id: string;
    score: number | string;
    total: number | string;
    percentage: number | string | null;
    level: string | null;
    scanned_at: string | null;
    created_at: string;
    assessment_packages?: { title?: string | null; subject?: string | null; grade?: number | null; week_number?: number | null } | Array<{ title?: string | null; subject?: string | null; grade?: number | null; week_number?: number | null }> | null;
  } | null;

  const questionRows = result
    ? await db
        .from("student_question_results")
        .select("is_correct, nafs_domains(domain_name), learning_skills(skill_name, remediation_summary)")
        .eq("student_package_result_id", result.id)
    : { data: [], error: null };

  return {
    tokenRow,
    student: studentResult.data,
    result,
    percentage: result ? pct(result.percentage) : null,
    questionRows: (questionRows.data ?? []) as QuestionResultRow[],
    weakestSkill: getWeakestSkill((questionRows.data ?? []) as QuestionResultRow[]),
  };
}
