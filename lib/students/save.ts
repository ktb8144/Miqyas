import "server-only";
import { getAdminClient } from "@/lib/supabase-admin";
import { cleanName, normalizeName } from "@/lib/format";
import { assignStudentCodes } from "@/lib/students/numbering";
import { studentCodeNumber, studentMatchKey } from "@/lib/students/order";
import { codesOf, loadSection, type SectionStudent } from "@/lib/students/section";

const STUDENT_COLUMNS = "id, name, class_id, school_id, student_number, student_code, score, total, created_at";

/**
 * Adds students to a class, skipping names already there, and gives each one the number
 * he shades on the answer sheet (see assignStudentCodes for the rules).
 *
 * With syncSection, a student added to one subject's copy of a section (e.g. 6/1 math) is also
 * added to the same section in the other subjects with the same number, so a mid-year joiner
 * doesn't exist in one subject only.
 */
export async function addStudentsToClass({
  schoolId,
  classId,
  names,
  keepOrder = false,
  syncSection = false,
}: {
  schoolId: string;
  classId: string;
  names: string[];
  /** Names come from a Noor/Excel file in roster order: keep that order for a new class. */
  keepOrder?: boolean;
  syncSection?: boolean;
}) {
  const db = getAdminClient();
  const cleanedNames = names.map(cleanName).filter(Boolean);
  const uniqueNames: string[] = [];
  const incomingSeen = new Set<string>();
  cleanedNames.forEach((name) => {
    const key = normalizeName(name);
    if (!incomingSeen.has(key)) {
      incomingSeen.add(key);
      uniqueNames.push(name);
    }
  });

  const section = await loadSection(db, schoolId, classId);
  const existingRows = section.studentsByClass.get(classId) ?? [];
  const existingNames = new Set(existingRows.map((row) => normalizeName(row.name)));
  const namesToInsert = uniqueNames.filter((name) => !existingNames.has(normalizeName(name)));
  if (!namesToInsert.length) {
    return { students: [], added: 0, duplicates: cleanedNames.length, syncedClassIds: [] as string[] };
  }

  const siblingStudents: SectionStudent[] = section.siblings
    // The fullest copy of the section is the reference when subjects disagree.
    .map((row) => section.studentsByClass.get(row.id) ?? [])
    .sort((a, b) => b.length - a.length)
    .flat();
  const sectionCodeByName = new Map<string, number>();
  siblingStudents.forEach((row) => {
    const code = studentCodeNumber(row.student_code);
    const key = studentMatchKey(row.name);
    if (code && !sectionCodeByName.has(key)) sectionCodeByName.set(key, code);
  });
  const takenInSection = codesOf([...existingRows, ...siblingStudents]);

  const planned = assignStudentCodes({
    newNames: namesToInsert,
    takenInClass: codesOf(existingRows),
    takenInSection,
    sectionCodeByName,
    keepOrder,
  });

  const { data: students, error: insertError } = await db
    .from("students")
    .insert(
      planned.map(({ name, code }) => ({
        name,
        school_id: schoolId,
        class_id: classId,
        student_number: null,
        student_code: String(code),
        score: 0,
        total: 10,
      }))
    )
    .select(STUDENT_COLUMNS);
  if (insertError) throw insertError;

  const syncedClassIds: string[] = [];
  if (syncSection) {
    const plannedCodeByName = new Map(planned.map(({ name, code }) => [studentMatchKey(name), code]));
    planned.forEach(({ code }) => takenInSection.add(code));
    for (const sibling of section.siblings) {
      const siblingRows = section.studentsByClass.get(sibling.id) ?? [];
      // A section someone hasn't filled yet stays empty: its teacher imports it when ready.
      if (!siblingRows.length) continue;
      const siblingNames = new Set(siblingRows.map((row) => studentMatchKey(row.name)));
      const missing = planned.map(({ name }) => name).filter((name) => !siblingNames.has(studentMatchKey(name)));
      if (!missing.length) continue;
      const siblingPlan = assignStudentCodes({
        newNames: missing,
        takenInClass: codesOf(siblingRows),
        takenInSection,
        sectionCodeByName: plannedCodeByName,
        keepOrder: false,
      });
      const { error: syncError } = await db.from("students").insert(
        siblingPlan.map(({ name, code }) => ({
          name,
          school_id: schoolId,
          class_id: sibling.id,
          student_number: null,
          student_code: String(code),
          score: 0,
          total: 10,
        }))
      );
      if (syncError) {
        // The class the teacher asked for is saved; the other subjects can be fixed by adding the name there.
        console.error("section sync failed", { classId, siblingId: sibling.id, message: syncError.message });
        continue;
      }
      siblingPlan.forEach(({ code }) => takenInSection.add(code));
      syncedClassIds.push(sibling.id);
    }
  }

  return {
    students: students ?? [],
    added: students?.length ?? 0,
    duplicates: cleanedNames.length - (students?.length ?? 0),
    syncedClassIds,
  };
}
