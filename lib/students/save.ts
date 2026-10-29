import "server-only";
import { getAdminClient } from "@/lib/supabase-admin";
import { cleanName, normalizeName } from "@/lib/format";

/**
 * Adds students to a class, skipping names already there.
 * Each new student gets the next free number (1, 2, 3…) in the order given,
 * which is the number the student shades on the answer sheet.
 */
export async function addStudentsToClass({
  schoolId,
  classId,
  names,
}: {
  schoolId: string;
  classId: string;
  names: string[];
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

  const { data: existingRows, error: existingError } = await db
    .from("students")
    .select("name, student_code")
    .eq("class_id", classId)
    .eq("school_id", schoolId);
  if (existingError) throw existingError;

  const existingNames = new Set((existingRows ?? []).map((row) => normalizeName(row.name)));
  const existingCodes = new Set(
    (existingRows ?? [])
      .map((row) => Number(String(row.student_code ?? "").replace(/^0+/, "")))
      .filter((value) => Number.isInteger(value) && value > 0)
  );
  const namesToInsert = uniqueNames.filter((name) => !existingNames.has(normalizeName(name)));
  if (!namesToInsert.length) {
    return { students: [], added: 0, duplicates: cleanedNames.length };
  }

  let nextCode = 1;
  const rows = namesToInsert.map((name) => {
    while (existingCodes.has(nextCode)) nextCode += 1;
    const studentCode = String(nextCode);
    existingCodes.add(nextCode);
    nextCode += 1;
    return {
      name,
      school_id: schoolId,
      class_id: classId,
      student_number: null,
      student_code: studentCode,
      score: 0,
      total: 10,
    };
  });

  const { data: students, error: insertError } = await db
    .from("students")
    .insert(rows)
    .select("id, name, class_id, school_id, student_number, student_code, score, total, created_at");
  if (insertError) throw insertError;

  return {
    students: students ?? [],
    added: students?.length ?? 0,
    duplicates: cleanedNames.length - (students?.length ?? 0),
  };
}
