import "server-only";
import type { getAdminClient } from "@/lib/supabase-admin";
import { normalizeName, toEnglishDigits } from "@/lib/format";
import { studentCodeNumber } from "@/lib/students/order";

type Db = ReturnType<typeof getAdminClient>;

export type SectionClass = { id: string; name: string; grade: number | null; subject: string | null; teacher_id: string };
export type SectionStudent = { id: string; class_id: string; school_id: string; name: string; student_code: string | null };

/** "6 / 1", "٦/١" and "6/1" are the same section. */
export function sectionKey(name: string) {
  return normalizeName(toEnglishDigits(name)).replace(/\s*[/\\-]\s*/g, "/");
}

/**
 * The same section in other subjects: each subject teacher has their own copy of a class
 * (same school, same grade, same name). Returns the class itself first, then its siblings.
 */
export async function loadSection(db: Db, schoolId: string, classId: string) {
  const { data: classRow, error: classError } = await db
    .from("classes")
    .select("id, name, grade, subject, teacher_id")
    .eq("id", classId)
    .eq("school_id", schoolId)
    .single();
  if (classError) throw classError;
  const target = classRow as SectionClass;

  let siblings: SectionClass[] = [];
  if (target.grade !== null && target.grade !== undefined && target.name) {
    const { data: sameGrade, error: siblingsError } = await db
      .from("classes")
      .select("id, name, grade, subject, teacher_id")
      .eq("school_id", schoolId)
      .eq("grade", target.grade)
      .neq("id", classId);
    if (siblingsError) throw siblingsError;
    const key = sectionKey(target.name);
    siblings = ((sameGrade ?? []) as SectionClass[]).filter((row) => row.name && sectionKey(row.name) === key);
  }

  const classIds = [target.id, ...siblings.map((row) => row.id)];
  const { data: studentRows, error: studentsError } = await db
    .from("students")
    .select("id, class_id, school_id, name, student_code")
    .eq("school_id", schoolId)
    .in("class_id", classIds);
  if (studentsError) throw studentsError;

  const studentsByClass = new Map<string, SectionStudent[]>(classIds.map((id) => [id, []]));
  ((studentRows ?? []) as SectionStudent[]).forEach((row) => studentsByClass.get(row.class_id)?.push(row));

  return { target, siblings, classes: [target, ...siblings], studentsByClass };
}

export function codesOf(students: SectionStudent[]) {
  return new Set(students.map((row) => studentCodeNumber(row.student_code)).filter((code): code is number => code !== null));
}
