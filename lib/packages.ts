import "server-only";
import { getAdminClient } from "@/lib/supabase-admin";
import { normalizeSubject } from "@/lib/subjects";

const PAGE_SIZE = 1000; // Supabase returns at most 1000 rows per request.

/**
 * Counts rows per package in ONE paginated query instead of one query per package.
 * `orFilter` is an optional PostgREST `or(...)` expression applied to the rows.
 */
export async function countRowsByPackage(
  table: "package_questions" | "school_package_assignments",
  packageIds: string[],
  orFilter?: string
) {
  const ids = Array.from(new Set(packageIds));
  const counts = new Map<string, number>(ids.map((id) => [id, 0]));
  if (!ids.length) return counts;

  const db = getAdminClient();
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = db
      .from(table)
      .select("package_id")
      .in("package_id", ids)
      .order("id")
      .range(from, from + PAGE_SIZE - 1);
    if (orFilter) query = query.or(orFilter);

    const { data, error } = await query;
    if (error) throw error;

    for (const row of (data ?? []) as { package_id: string }[]) {
      counts.set(row.package_id, (counts.get(row.package_id) ?? 0) + 1);
    }
    if (!data || data.length < PAGE_SIZE) break;
  }

  return counts;
}

export function countPackageQuestions(packageIds: string[]) {
  return countRowsByPackage("package_questions", packageIds);
}

/** Questions still missing a domain or a skill mapping. */
export function countIncompletePackageQuestions(packageIds: string[]) {
  return countRowsByPackage(
    "package_questions",
    packageIds,
    "and(nafs_domain_id.is.null,domain_text.is.null),and(skill_id.is.null,skill_text.is.null)"
  );
}

/** A class receives a package when grade and (normalised) subject match. */
export function classMatchesPackage(
  classItem: { grade?: number | string | null; subject?: string | null },
  assessmentPackage: { grade?: number | string | null; subject?: string | null }
) {
  const classGrade = Number(classItem.grade);
  return (
    Number.isFinite(classGrade) &&
    classGrade === Number(assessmentPackage.grade) &&
    normalizeSubject(classItem.subject) === normalizeSubject(assessmentPackage.subject)
  );
}
