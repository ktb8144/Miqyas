import { z } from "zod";
import { toEnglishDigits } from "@/lib/format";

/** A school's previous NAFS results, as printed in its school report — one row per year × grade × subject. */

export const NAFS_SUBJECTS = ["رياضيات", "قراءة", "علوم"] as const;
export type NafsSubject = (typeof NAFS_SUBJECTS)[number];
export const NAFS_GRADES = [3, 6] as const;

/** Which NAFS subjects each tested grade sits. */
export function subjectsForGrade(grade: number): NafsSubject[] {
  return grade === 3 ? ["رياضيات", "قراءة"] : ["رياضيات", "قراءة", "علوم"];
}

/** Starting names for the domain rows; the principal can rename them to match the report. */
export const DOMAIN_SUGGESTIONS: Record<NafsSubject, string[]> = {
  "رياضيات": ["الأعداد والعمليات عليها", "الجبر", "الهندسة والقياس", "البيانات والاحتمالات"],
  "علوم": ["علوم الحياة", "العلوم الفيزيائية", "علوم الأرض والفضاء"],
  "قراءة": ["فهم المقروء"],
};

/** The Dala subject that trains each NAFS subject. */
export const DALA_SUBJECT: Record<NafsSubject, string> = {
  "رياضيات": "رياضيات",
  "قراءة": "لغة عربية",
  "علوم": "علوم",
};

const percent = z.number().min(0).max(100);

export const baselineSchema = z.object({
  year: z.number().int().min(2018).max(2100),
  grade: z.union([z.literal(3), z.literal(6)]),
  subject: z.enum(NAFS_SUBJECTS),
  overallPercent: percent.nullable(),
  masteryPercent: percent.nullable(),
  testedCount: z.number().int().min(0).max(5000).nullable(),
  absentCount: z.number().int().min(0).max(5000).nullable(),
  domains: z.array(z.object({ name: z.string().trim().min(1).max(80), percent })).max(12),
});

export type NafsBaseline = z.infer<typeof baselineSchema>;

export type NafsBaselineRow = {
  year: number;
  grade: number;
  subject: string;
  overall_percent: number | string | null;
  mastery_percent: number | string | null;
  tested_count: number | null;
  absent_count: number | null;
  domains: unknown;
};

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function fromRow(row: NafsBaselineRow): NafsBaseline {
  const domains = Array.isArray(row.domains)
    ? (row.domains as Array<{ name?: unknown; percent?: unknown }>)
        .map((d) => ({ name: String(d.name ?? "").trim(), percent: Number(d.percent) }))
        .filter((d) => d.name && Number.isFinite(d.percent))
    : [];
  return {
    year: row.year,
    grade: row.grade === 3 ? 3 : 6,
    subject: (NAFS_SUBJECTS as readonly string[]).includes(row.subject) ? (row.subject as NafsSubject) : "رياضيات",
    overallPercent: toNumber(row.overall_percent),
    masteryPercent: toNumber(row.mastery_percent),
    testedCount: row.tested_count,
    absentCount: row.absent_count,
    domains,
  };
}

/**
 * Reads the Excel/CSV template: columns السنة، الصف، المادة، المجال، النسبة.
 * Special "المجال" values: الإجمالي (overall %), نسبة التمكن (mastery %), عدد المختبرين, عدد الغائبين.
 */
export function baselinesFromTable(rows: string[][]): NafsBaseline[] {
  const header = rows.findIndex((row) => row.some((cell) => /المجال/.test(cell)) && row.some((cell) => /النسبة|القيمة/.test(cell)));
  if (header < 0) return [];
  const index = (pattern: RegExp) => rows[header].findIndex((cell) => pattern.test(cell));
  const col = { year: index(/السنة|العام/), grade: index(/الصف/), subject: index(/المادة/), domain: index(/المجال/), value: index(/النسبة|القيمة/) };
  if (Object.values(col).some((c) => c < 0)) return [];

  const map = new Map<string, NafsBaseline>();
  for (const raw of rows.slice(header + 1)) {
    const cell = (c: number) => toEnglishDigits(String(raw[c] ?? "")).trim();
    const year = Number(cell(col.year));
    const grade = /3|الثالث/.test(cell(col.grade)) ? 3 : /6|السادس/.test(cell(col.grade)) ? 6 : null;
    const subjectText = cell(col.subject);
    const subject = NAFS_SUBJECTS.find((s) => subjectText.includes(s)) ?? (/لغ|عرب/.test(subjectText) ? "قراءة" : null);
    const domain = cell(col.domain);
    const value = Number(cell(col.value).replace("%", ""));
    if (!Number.isInteger(year) || !grade || !subject || !domain || !Number.isFinite(value)) continue;

    const key = `${year}|${grade}|${subject}`;
    const entry = map.get(key) ?? {
      year, grade: grade as 3 | 6, subject, overallPercent: null, masteryPercent: null, testedCount: null, absentCount: null, domains: [],
    };
    if (/الإجمالي|الاجمالي|المتوسط/.test(domain)) entry.overallPercent = value;
    else if (/التمكن/.test(domain)) entry.masteryPercent = value;
    else if (/المختبرين|المختبَرين/.test(domain)) entry.testedCount = Math.round(value);
    else if (/الغائبين|الغياب/.test(domain)) entry.absentCount = Math.round(value);
    else if (value >= 0 && value <= 100) entry.domains.push({ name: domain, percent: value });
    map.set(key, entry);
  }
  return Array.from(map.values());
}

export const BASELINE_TEMPLATE_CSV = [
  "السنة,الصف,المادة,المجال,النسبة",
  "2025,6,رياضيات,الإجمالي,",
  "2025,6,رياضيات,نسبة التمكن,",
  "2025,6,رياضيات,الأعداد والعمليات عليها,",
  "2025,6,رياضيات,الجبر,",
  "2025,6,رياضيات,الهندسة والقياس,",
  "2025,6,رياضيات,البيانات والاحتمالات,",
  "2025,6,علوم,الإجمالي,",
  "2025,6,علوم,علوم الحياة,",
  "2025,6,علوم,العلوم الفيزيائية,",
  "2025,6,علوم,علوم الأرض والفضاء,",
  "2025,6,قراءة,الإجمالي,",
  "2025,6,قراءة,فهم المقروء,",
  "2025,6,رياضيات,عدد المختبرين,",
  "2025,6,رياضيات,عدد الغائبين,",
].join("\n");
