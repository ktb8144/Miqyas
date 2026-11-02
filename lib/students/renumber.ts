import "server-only";
import { getAdminClient } from "@/lib/supabase-admin";
import { alphabeticalSectionCodes } from "@/lib/students/numbering";
import { studentCodeNumber, studentMatchKey } from "@/lib/students/order";
import { loadSection } from "@/lib/students/section";

/** A test printed this recently with sheets still unscanned may still come back to be scanned. */
const PENDING_WINDOW_DAYS = 30;

export type PendingTest = { className: string; subject: string | null; title: string; scanned: number; students: number };

type AssignmentRow = {
  id: string;
  class_id: string;
  status: string;
  printed_at: string | null;
  scanned_at: string | null;
  created_at: string;
  assessment_packages?: { title?: string | null } | Array<{ title?: string | null }> | null;
};

/**
 * Renumbers a class and the same section in the other subjects alphabetically: 1, 2, 3…
 * Results stay with their student (they are stored by student id, not by number); only sheets
 * printed with the old numbers and not yet scanned would be credited to the wrong student, so
 * those are reported first and the renumber only goes ahead with force.
 */
export async function renumberSectionAlphabetically({
  schoolId,
  classId,
  force,
}: {
  schoolId: string;
  classId: string;
  force: boolean;
}): Promise<{ ok: true; changed: number; classIds: string[] } | { ok: false; pending: PendingTest[] }> {
  const db = getAdminClient();
  const section = await loadSection(db, schoolId, classId);
  const classIds = section.classes.map((row) => row.id);

  if (!force) {
    const pending = await findPendingTests(db, schoolId, section.classes, section.studentsByClass);
    if (pending.length) return { ok: false, pending };
  }

  const allStudents = classIds.flatMap((id) => section.studentsByClass.get(id) ?? []);
  const codeByName = alphabeticalSectionCodes(allStudents.map((row) => row.name));

  const changedStudents = new Set<string>();
  for (const id of classIds) {
    const rows = section.studentsByClass.get(id) ?? [];
    const updates = rows.map((row) => ({ ...row, next: codeByName.get(studentMatchKey(row.name)) ?? null }));
    if (updates.every((row) => studentCodeNumber(row.student_code) === row.next)) continue;

    // Two steps because each number is unique per class: clear, then set. If the second step fails
    // the numbers are empty (never duplicated) and pressing the button again finishes the job.
    const { error: clearError } = await db.from("students").update({ student_code: null }).eq("class_id", id).eq("school_id", schoolId);
    if (clearError) throw clearError;
    const { error: setError } = await db.from("students").upsert(
      updates.map((row) => ({
        id: row.id,
        school_id: row.school_id,
        class_id: row.class_id,
        name: row.name,
        student_code: row.next === null ? null : String(row.next),
      })),
      { onConflict: "id" }
    );
    if (setError) throw setError;
    updates
      .filter((row) => studentCodeNumber(row.student_code) !== row.next)
      .forEach((row) => changedStudents.add(studentMatchKey(row.name)));
  }

  // Counted per student, not per subject copy.
  return { ok: true, changed: changedStudents.size, classIds };
}

async function findPendingTests(
  db: ReturnType<typeof getAdminClient>,
  schoolId: string,
  classes: Array<{ id: string; name: string; subject: string | null }>,
  studentsByClass: Map<string, unknown[]>
): Promise<PendingTest[]> {
  const since = Date.now() - PENDING_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const { data: assignments, error } = await db
    .from("class_package_assignments")
    .select("id, class_id, status, printed_at, scanned_at, created_at, assessment_packages(title)")
    .eq("school_id", schoolId)
    .in("class_id", classes.map((row) => row.id))
    .in("status", ["printed", "in_progress", "scanned"]);
  if (error) throw error;

  const recent = ((assignments ?? []) as AssignmentRow[]).filter((row) => {
    const last = row.printed_at ?? row.scanned_at ?? row.created_at;
    return last && new Date(last).getTime() >= since;
  });
  if (!recent.length) return [];

  const { data: results, error: resultsError } = await db
    .from("student_package_results")
    .select("class_package_assignment_id, student_id")
    .in("class_package_assignment_id", recent.map((row) => row.id));
  if (resultsError) throw resultsError;
  const scannedByAssignment = new Map<string, Set<string>>();
  ((results ?? []) as Array<{ class_package_assignment_id: string; student_id: string }>).forEach((row) => {
    const set = scannedByAssignment.get(row.class_package_assignment_id) ?? new Set<string>();
    set.add(row.student_id);
    scannedByAssignment.set(row.class_package_assignment_id, set);
  });

  const classById = new Map(classes.map((row) => [row.id, row]));
  return recent
    .map((row) => {
      const pkg = Array.isArray(row.assessment_packages) ? row.assessment_packages[0] : row.assessment_packages;
      const cls = classById.get(row.class_id);
      return {
        className: cls?.name ?? "",
        subject: cls?.subject ?? null,
        title: pkg?.title ?? "اختبار",
        scanned: scannedByAssignment.get(row.id)?.size ?? 0,
        students: studentsByClass.get(row.class_id)?.length ?? 0,
      };
    })
    .filter((row) => row.scanned < row.students);
}
