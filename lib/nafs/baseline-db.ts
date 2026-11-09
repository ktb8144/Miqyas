import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fromRow, type NafsBaseline, type NafsBaselineRow } from "@/lib/nafs/baseline";

/**
 * Reads and writes public.nafs_baselines. The `levels` column comes from migration
 * 20261109010000_add_nafs_baseline_levels.sql; until it is applied, both functions fall back to
 * the columns that already exist, so nothing breaks (levels are simply not kept).
 */

const BASE_COLUMNS = "year, grade, subject, overall_percent, mastery_percent, tested_count, absent_count, domains";

type DbError = { code?: string; message?: string } | null;

export function missingLevelsColumn(error: DbError) {
  return Boolean(error && (error.code === "42703" || error.code === "PGRST204") && /levels/.test(error.message ?? ""));
}

export async function selectBaselines(db: SupabaseClient, schoolId: string): Promise<{ baselines: NafsBaseline[]; error: DbError }> {
  const read = (columns: string) =>
    db.from("nafs_baselines").select(columns).eq("school_id", schoolId).order("year", { ascending: false });
  let { data, error } = await read(`${BASE_COLUMNS}, levels`);
  if (missingLevelsColumn(error)) ({ data, error } = await read(BASE_COLUMNS));
  if (error) return { baselines: [], error };
  return { baselines: ((data ?? []) as unknown as NafsBaselineRow[]).map(fromRow), error: null };
}

export async function upsertBaselines(db: SupabaseClient, schoolId: string, userId: string, baselines: NafsBaseline[]): Promise<DbError> {
  const now = new Date().toISOString();
  const rows = baselines.map((b) => ({
    school_id: schoolId,
    year: b.year,
    grade: b.grade,
    subject: b.subject,
    overall_percent: b.overallPercent,
    mastery_percent: b.masteryPercent,
    tested_count: b.testedCount,
    absent_count: b.absentCount,
    domains: b.domains,
    levels: b.levels,
    created_by: userId,
    updated_at: now,
  }));
  const write = (payload: Array<Record<string, unknown>>) =>
    db.from("nafs_baselines").upsert(payload, { onConflict: "school_id,year,grade,subject" });
  let { error } = await write(rows);
  if (missingLevelsColumn(error)) {
    const withoutLevels = rows.map((row) => {
      const rest: Record<string, unknown> = { ...row };
      delete rest.levels;
      return rest;
    });
    ({ error } = await write(withoutLevels));
  }
  return error;
}
