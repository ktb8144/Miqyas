import "server-only";
import { getAdminClient } from "@/lib/supabase-admin";
import { saudiToday } from "@/lib/test-schedule";
import { TRIAL_SCAN_QUOTA, type SchoolKind } from "@/lib/schools";

type Db = ReturnType<typeof getAdminClient>;

export type SchoolPlan = {
  kind: SchoolKind;
  active: boolean;
  trial: boolean;
  startedAt: string | null;
  endsAt: string | null;
  /** Trial accounts only; null = no cap. */
  quota: number | null;
  used: number;
  expired: boolean;
  quotaReached: boolean;
  /** Arabic reason scanning is blocked, or null when it is allowed. */
  blockedReason: string | null;
};

/** The school's plan and how many papers it has sent to the AI reader in the current period. */
export async function getSchoolPlan(db: Db, schoolId: string): Promise<SchoolPlan | null> {
  const { data: school, error } = await db
    .from("schools")
    .select("kind, active, trial, subscription_start, subscription_end, scan_quota")
    .eq("id", schoolId)
    .maybeSingle();
  if (error) throw error;
  if (!school) return null;

  const kind = (school.kind as SchoolKind) ?? "school";
  const trial = school.trial === true;
  const startedAt = (school.subscription_start as string | null) ?? null;
  const endsAt = (school.subscription_end as string | null) ?? null;
  const quota = trial ? ((school.scan_quota as number | null) ?? TRIAL_SCAN_QUOTA[kind]) : null;

  let used = 0;
  if (quota !== null) {
    let query = db.from("scan_usage").select("id", { count: "exact", head: true }).eq("school_id", schoolId);
    if (startedAt) query = query.gte("created_at", `${startedAt}T00:00:00+03:00`);
    const { count, error: countError } = await query;
    if (countError) throw countError;
    used = count ?? 0;
  }

  const expired = trial && Boolean(endsAt) && endsAt! < saudiToday();
  const quotaReached = quota !== null && used >= quota;
  const blockedReason = school.active === false
    ? "اشتراك هذا الحساب موقوف. تواصل مع فريق دالة لإعادة التفعيل."
    : expired
      ? "انتهت الفترة التجريبية. نتائجك محفوظة، وللاستمرار في التصحيح تواصل معنا للاشتراك."
      : quotaReached
        ? `وصلت إلى حد التجربة (${quota} ورقة). نتائجك محفوظة، وللاستمرار تواصل معنا للاشتراك.`
        : null;

  return { kind, active: school.active !== false, trial, startedAt, endsAt, quota, used, expired, quotaReached, blockedReason };
}

/** Records one paper sent to the AI reader (never throws: tracking must not break grading). */
export async function recordScanUsage(
  db: Db,
  row: {
    schoolId: string;
    userId: string;
    classPackageAssignmentId: string;
    succeeded: boolean;
    model: string;
    inputTokens?: number | null;
    outputTokens?: number | null;
    thinkingTokens?: number | null;
  }
) {
  const { error } = await db.from("scan_usage").insert({
    school_id: row.schoolId,
    user_id: row.userId,
    class_package_assignment_id: row.classPackageAssignmentId,
    succeeded: row.succeeded,
    model: row.model,
    input_tokens: row.inputTokens ?? null,
    output_tokens: row.outputTokens ?? null,
    thinking_tokens: row.thinkingTokens ?? null,
  });
  if (error) console.error("record scan usage failed", error);
}
