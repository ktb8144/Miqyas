import { cleanName, normalizeStudentCode, toEnglishDigits } from "@/lib/format";

/**
 * Alphabetical (هجائي) order for student names, matching the class roster.
 *
 * The browser's Arabic collation already treats أ/إ/آ/ا as one letter and ignores tashkeel.
 * The only fix needed is «عبد العزيز» vs «عبدالعزيز»: the same name, written with or without a space,
 * so both sort as one word. The stored name is never changed — this is only the sort key.
 */
const collator = new Intl.Collator("ar", { numeric: true });

export function arabicNameSortKey(name: string) {
  return cleanName(toEnglishDigits(name))
    .replace(/[ـ]/g, "") // tatweel
    .replace(/(^|\s)عبد\s+(?=ال)/g, "$1عبد");
}

/**
 * Key for "is this the same student?" across the subjects of one section, where each teacher may have
 * typed the name a little differently (أحمد/احمد, عبد الله/عبدالله, حمزة/حمزه, يحيى/يحيي, tashkeel).
 */
export function studentMatchKey(name: string) {
  return arabicNameSortKey(name)
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .toLowerCase();
}

export function compareArabicNames(a: string, b: string) {
  return collator.compare(arabicNameSortKey(a), arabicNameSortKey(b)) || collator.compare(a, b);
}

/** The number a student shades on the sheet, as a positive integer (null when missing or invalid). */
export function studentCodeNumber(value: unknown): number | null {
  const code = Number(normalizeStudentCode(value));
  return Number.isInteger(code) && code > 0 ? code : null;
}

/** A copy of the list in alphabetical order; equal names fall back to the student number. */
export function sortByStudentName<T extends { name: string }>(
  list: readonly T[],
  codeOf: (item: T) => unknown = () => null
): T[] {
  return [...list].sort(
    (a, b) =>
      compareArabicNames(a.name, b.name) ||
      (studentCodeNumber(codeOf(a)) ?? Number.MAX_SAFE_INTEGER) - (studentCodeNumber(codeOf(b)) ?? Number.MAX_SAFE_INTEGER)
  );
}

/**
 * True when reading the list alphabetically gives the numbers 1, 2, 3… in rising order.
 * False after a student joins mid-year (he sits in his alphabetical place but keeps the next free number).
 */
export function codesFollowNameOrder<T extends { name: string }>(list: readonly T[], codeOf: (item: T) => unknown) {
  let previous = 0;
  for (const item of sortByStudentName(list, codeOf)) {
    const code = studentCodeNumber(codeOf(item));
    if (code === null || code <= previous) return false;
    previous = code;
  }
  return true;
}
