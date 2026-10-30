import { cleanName, normalizeName, toEnglishDigits } from "@/lib/format";

/**
 * Finds students in a table exported from Noor (or any class list).
 * Only three columns are ever taken: the name, the serial number, and the class/section.
 * Identity numbers and every other column are ignored on purpose and never leave the browser.
 */

export type RosterRow = { name: string; serial: number | null; section: string };

export type RosterDetection = {
  rows: RosterRow[];
  sections: string[];
  headerRow: number | null;
  nameColumn: number;
  serialColumn: number | null;
  sectionColumn: number | null;
  /** Columns that look like identity numbers; reported so the UI can say they were skipped. */
  skippedIdColumns: number;
};

const NAME_HEADER = /اسم|الاسم|الطالب|الطالبة/;
const SERIAL_HEADER = /^(م|ت|#|الرقم|رقم|التسلسل|مسلسل|تسلسل|رقم الطالب في الفصل)$/;
const SECTION_HEADER = /الفصل|الشعبة|الصف|القسم/;
const ARABIC = /[؀-ۿ]/;
const LONG_NUMBER = /^\d{6,}$/;

function cellText(value: unknown) {
  if (value === null || value === undefined) return "";
  return toEnglishDigits(String(value)).replace(/\s+/g, " ").trim();
}

function looksLikeName(text: string) {
  if (!ARABIC.test(text) && !/[a-z]{2,}/i.test(text)) return false;
  if (/\d{3,}/.test(text)) return false;
  const words = text.split(" ").filter(Boolean);
  return words.length >= 2 && text.length <= 120;
}

/** Turns "السادس / 1", "6/2", "الفصل 3" into a short section label. */
export function normalizeSection(text: string) {
  return cellText(text).replace(/\s*[/\\-]\s*/g, "/");
}

/** Guesses a grade (1–12) from a section label such as "السادس/1" or "6/2". */
export function gradeFromSection(section: string): number | null {
  const words: Array<[RegExp, number]> = [
    [/الأول|الاول/, 1], [/الثاني/, 2], [/الثالث/, 3], [/الرابع/, 4], [/الخامس/, 5], [/السادس/, 6],
  ];
  for (const [pattern, grade] of words) if (pattern.test(section)) return grade;
  const numeric = section.match(/^(\d{1,2})\s*\//);
  if (numeric) {
    const grade = Number(numeric[1]);
    if (grade >= 1 && grade <= 12) return grade;
  }
  return null;
}

export function detectRoster(table: unknown[][]): RosterDetection | null {
  const rows = table.map((row) => (Array.isArray(row) ? row.map(cellText) : []));
  const width = Math.max(0, ...rows.map((row) => row.length));
  if (!rows.length || !width) return null;

  // 1. A header row in the first 20 rows that names the student column ("اسم" first, so "رقم الطالب" never wins).
  let headerRow: number | null = null;
  let nameColumn = -1;
  for (const pattern of [/اسم|الاسم/, NAME_HEADER]) {
    for (let r = 0; r < Math.min(rows.length, 20) && headerRow === null; r++) {
      const c = rows[r].findIndex((cell) => pattern.test(cell) && cell.length <= 30 && !/رقم|هوية|سجل/.test(cell));
      if (c >= 0) {
        headerRow = r;
        nameColumn = c;
      }
    }
    if (headerRow !== null) break;
  }

  const dataStart = headerRow === null ? 0 : headerRow + 1;
  const body = rows.slice(dataStart);

  // 2. No header: the column with the most name-like cells.
  if (nameColumn < 0) {
    let best = 0;
    for (let c = 0; c < width; c++) {
      const count = body.filter((row) => looksLikeName(row[c] ?? "")).length;
      if (count > best) {
        best = count;
        nameColumn = c;
      }
    }
    if (best < 2) return null;
  }

  const header = headerRow === null ? [] : rows[headerRow];
  let serialColumn: number | null = null;
  let sectionColumn: number | null = null;
  let sectionDistinct = 0;
  let skippedIdColumns = 0;
  for (let c = 0; c < width; c++) {
    if (c === nameColumn) continue;
    const values = body.map((row) => row[c] ?? "").filter(Boolean);
    if (values.length && values.filter((v) => LONG_NUMBER.test(v)).length / values.length > 0.6) {
      skippedIdColumns++;
      continue;
    }
    const title = header[c] ?? "";
    const smallNumbers = values.length > 0 && values.every((v) => /^\d{1,3}$/.test(v) && Number(v) <= 200);
    if (serialColumn === null && smallNumbers && (SERIAL_HEADER.test(title) || headerRow === null || !title)) {
      serialColumn = c;
      continue;
    }
    if (SECTION_HEADER.test(title) && values.length) {
      // Prefer the column that actually separates classes ("الفصل" with 6/1, 6/2…) over a constant "الصف".
      const distinct = new Set(values.map(normalizeSection)).size + (/فصل|شعبة/.test(title) ? 0.5 : 0);
      if (distinct > sectionDistinct) {
        sectionDistinct = distinct;
        sectionColumn = c;
      }
    }
  }

  // Noor often splits the grade ("السادس الابتدائي") and the section ("1") into two columns.
  // When the section alone has no grade, take it from that other column: "1" → "6/1".
  let gradeColumn: number | null = null;
  for (let c = 0; c < width && sectionColumn !== null; c++) {
    if (c === sectionColumn || c === nameColumn || c === serialColumn) continue;
    const values = body.map((row) => row[c] ?? "").filter(Boolean);
    if (values.length && values.filter((v) => gradeFromSection(v) !== null && !/\//.test(v)).length / values.length > 0.8) {
      gradeColumn = c;
      break;
    }
  }

  const seen = new Set<string>();
  const result: RosterRow[] = [];
  body.forEach((row) => {
    const name = cleanName(row[nameColumn] ?? "");
    if (!looksLikeName(name) || (NAME_HEADER.test(name) && name.length < 15)) return;
    let section = sectionColumn === null ? "" : normalizeSection(row[sectionColumn] ?? "");
    if (gradeColumn !== null && /^\d{1,2}$/.test(section)) {
      const grade = gradeFromSection(row[gradeColumn] ?? "");
      if (grade) section = `${grade}/${section}`;
    }
    const key = `${section}|${normalizeName(name)}`;
    if (seen.has(key)) return;
    seen.add(key);
    const serialValue = serialColumn === null ? NaN : Number(row[serialColumn]);
    result.push({ name, serial: Number.isInteger(serialValue) && serialValue > 0 ? serialValue : null, section });
  });
  if (!result.length) return null;

  // Keep the list in the class order (serial), so student numbers match the paper list.
  if (result.every((row) => row.serial !== null)) {
    result.sort((a, b) => (a.section === b.section ? (a.serial ?? 0) - (b.serial ?? 0) : a.section.localeCompare(b.section, "ar")));
  }

  const sections = Array.from(new Set(result.map((row) => row.section))).filter(Boolean);
  return { rows: result, sections, headerRow, nameColumn, serialColumn, sectionColumn, skippedIdColumns };
}
