import { compareArabicNames, studentMatchKey } from "@/lib/students/order";

/**
 * Which number (رقم الطالب في الكشف) each new student gets. Pure: no database access.
 *
 * Rules:
 * - A number never changes once given, so sheets already printed stay valid.
 * - A student already in the same section for another subject keeps that number here too.
 * - A brand-new class is numbered 1, 2, 3… in the official roster order: the file's order when the
 *   names came from a Noor/Excel file, otherwise alphabetical.
 * - A student who joins later takes the next number free in the whole section (all subjects),
 *   so his number means him in every subject. He is still shown in his alphabetical place.
 */
export function assignStudentCodes({
  newNames,
  takenInClass,
  takenInSection,
  sectionCodeByName,
  keepOrder,
}: {
  /** Cleaned names not yet in this class. */
  newNames: string[];
  /** Numbers already used in this class. */
  takenInClass: ReadonlySet<number>;
  /** Numbers used anywhere in the section (this class and the same section in other subjects). */
  takenInSection: ReadonlySet<number>;
  /** studentMatchKey(name) → the number this student already has in the same section for another subject. */
  sectionCodeByName: ReadonlyMap<string, number>;
  /** Keep the given order for a new class (names from a Noor file); otherwise alphabetical. */
  keepOrder: boolean;
}): Array<{ name: string; code: number }> {
  const codeByName = new Map<string, number>();
  const used = new Set<number>(takenInClass);

  // 1. Same student, same section, another subject: same number.
  for (const name of newNames) {
    const code = sectionCodeByName.get(studentMatchKey(name));
    if (code && !used.has(code)) {
      codeByName.set(name, code);
      used.add(code);
    }
  }

  const rest = newNames.filter((name) => !codeByName.has(name));
  const ordered = keepOrder ? rest : [...rest].sort(compareArabicNames);

  if (takenInClass.size === 0 && codeByName.size === 0) {
    // 2. A new class with nothing in common with the section: 1, 2, 3… in roster order.
    ordered.forEach((name, index) => codeByName.set(name, index + 1));
  } else {
    // 3. Joining an existing list: next number free in the whole section.
    const blocked = new Set<number>([...Array.from(used), ...Array.from(takenInSection)]);
    let next = 1;
    for (const name of ordered) {
      while (blocked.has(next)) next += 1;
      codeByName.set(name, next);
      blocked.add(next);
    }
  }

  return newNames.map((name) => ({ name, code: codeByName.get(name)! }));
}

/**
 * studentMatchKey(name) → number. Renumbers a whole section alphabetically (used only on request, before printing new tests).
 * Every distinct student across the section's classes gets one number, the same in every subject.
 */
export function alphabeticalSectionCodes(names: string[]): Map<string, number> {
  const byKey = new Map<string, string>();
  names.forEach((name) => {
    const key = studentMatchKey(name);
    if (!byKey.has(key)) byKey.set(key, name);
  });
  const ordered = Array.from(byKey.entries()).sort((a, b) => compareArabicNames(a[1], b[1]));
  return new Map(ordered.map(([key], index) => [key, index + 1]));
}
