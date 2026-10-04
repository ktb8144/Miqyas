import "server-only";
import { randomInt } from "node:crypto";
import { getAdminClient } from "@/lib/supabase-admin";
import { addDays, saudiToday } from "@/lib/test-schedule";

type Db = ReturnType<typeof getAdminClient>;

export type SchoolKind = "school" | "individual";

export const TRIAL_DAYS = 30;
/** Papers the AI may read during the free trial (paid accounts have no cap). */
export const TRIAL_SCAN_QUOTA: Record<SchoolKind, number> = { school: 500, individual: 200 };

// No 0/O, 1/I/L: the code is read aloud and typed on phones.
const JOIN_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateJoinCode(length = 6) {
  return Array.from({ length }, () => JOIN_CODE_ALPHABET[randomInt(JOIN_CODE_ALPHABET.length)]).join("");
}

export function normalizeJoinCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Makes every published test available to the school, so a new school never starts empty. */
export async function enablePublishedTests(db: Db, schoolId: string) {
  const { data, error } = await db.from("assessment_packages").select("id").eq("status", "published");
  if (error) throw error;
  if (!data?.length) return 0;
  const now = new Date().toISOString();
  const { error: upsertError } = await db.from("school_package_assignments").upsert(
    data.map((pkg) => ({ package_id: pkg.id, school_id: schoolId, status: "available", assigned_at: now })),
    { onConflict: "package_id,school_id", ignoreDuplicates: true }
  );
  if (upsertError) throw upsertError;
  return data.length;
}

/**
 * Creates a school (or an independent teacher's space) on a free trial, with a join code
 * for teachers and every published test enabled.
 */
export async function provisionSchool(
  db: Db,
  input: {
    name: string;
    city: string;
    kind: SchoolKind;
    type?: string;
    region?: string | null;
    ministryNumber?: string | null;
    gender?: "boys" | "girls" | null;
  }
) {
  const today = saudiToday();
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await db
      .from("schools")
      .insert({
        name: input.name,
        city: input.city,
        region: input.region ?? null,
        type: input.type ?? (input.kind === "individual" ? "معلم مستقل" : "حكومية"),
        kind: input.kind,
        ministry_number: input.ministryNumber ?? null,
        gender: input.gender ?? null,
        join_code: input.kind === "school" ? generateJoinCode() : null,
        subscription_type: "trial",
        subscription_start: today,
        subscription_end: addDays(today, TRIAL_DAYS),
        active: true,
        trial: true,
        scan_quota: TRIAL_SCAN_QUOTA[input.kind],
      })
      .select("*")
      .single();

    if (!error && data) {
      await enablePublishedTests(db, data.id);
      return data as Record<string, unknown> & { id: string; join_code: string | null };
    }
    lastError = error;
    // Only a join-code collision is worth retrying.
    if (!(error && error.code === "23505" && String(error.message).includes("join_code"))) break;
  }
  throw lastError;
}
