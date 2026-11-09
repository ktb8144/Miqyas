import { baselineSchema, NAFS_SUBJECTS, subjectsForGrade, type NafsBaseline, type NafsSubject } from "@/lib/nafs/baseline";
import { toEnglishDigits } from "@/lib/format";

/**
 * Turns Claude's reading of a NAFS report into baselines the principal reviews before saving.
 * Claude writes -1 for any number it could not find; that becomes null here. Nothing is computed:
 * values are checked, not trusted, and anything doubtful becomes a warning for the principal.
 */

export type NafsReportReading = { isReport: boolean; baselines: NafsBaseline[]; warnings: string[] };

const MAX_WARNINGS = 8;

function number(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(toEnglishDigits(value).replace(/[%\s]/g, "").replace("٫", ".")) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function percent(value: unknown): number | null {
  const n = number(value);
  return n !== null && n <= 100 ? Math.round(n * 100) / 100 : null;
}

function count(value: unknown): number | null {
  const n = number(value);
  return n !== null && n <= 5000 ? Math.round(n) : null;
}

function namedPercents(value: unknown, max: number) {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: Array<{ name: string; percent: number }> = [];
  for (const item of value as Array<{ name?: unknown; percent?: unknown }>) {
    const name = String(item?.name ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
    const p = percent(item?.percent);
    if (!name || p === null || seen.has(name)) continue;
    seen.add(name);
    out.push({ name, percent: p });
    if (out.length >= max) break;
  }
  return out;
}

function subjectOf(value: unknown): NafsSubject | null {
  const text = String(value ?? "");
  const exact = NAFS_SUBJECTS.find((s) => text.includes(s));
  if (exact) return exact;
  if (/لغ|عرب|قراء/.test(text)) return "قراءة";
  if (/رياض/.test(text)) return "رياضيات";
  if (/علم|علوم/.test(text)) return "علوم";
  return null;
}

const keyOf = (b: Pick<NafsBaseline, "year" | "grade" | "subject">) => `${b.year}|${b.grade}|${b.subject}`;

/** Two readings of the same year × grade × subject (e.g. one per page): keep what each one found. */
function merge(a: NafsBaseline, b: NafsBaseline): NafsBaseline {
  return {
    ...a,
    overallPercent: a.overallPercent ?? b.overallPercent,
    masteryPercent: a.masteryPercent ?? b.masteryPercent,
    testedCount: a.testedCount ?? b.testedCount,
    absentCount: a.absentCount ?? b.absentCount,
    domains: a.domains.length >= b.domains.length ? a.domains : b.domains,
    levels: a.levels.length >= b.levels.length ? a.levels : b.levels,
  };
}

export function parseNafsReport(raw: unknown): NafsReportReading {
  const data = (raw ?? {}) as { isNafsReport?: unknown; results?: unknown; warnings?: unknown };
  const warnings = (Array.isArray(data.warnings) ? data.warnings : [])
    .map((w) => String(w ?? "").replace(/\s+/g, " ").trim().slice(0, 200))
    .filter(Boolean);
  if (data.isNafsReport === false) return { isReport: false, baselines: [], warnings: [] };

  const byKey = new Map<string, NafsBaseline>();
  for (const item of Array.isArray(data.results) ? (data.results as Array<Record<string, unknown>>) : []) {
    const year = number(item?.year);
    const grade = number(item?.grade);
    const subject = subjectOf(item?.subject);
    if (year === null || !Number.isInteger(year) || year < 2018 || year > 2100) continue;
    if (grade !== 3 && grade !== 6) continue;
    if (!subject) continue;
    if (!subjectsForGrade(grade).includes(subject)) {
      warnings.push(`تجاهلنا «${subject}» للصف ${grade === 3 ? "الثالث" : "السادس"} لأن نافس لا يختبرها في هذا الصف.`);
      continue;
    }
    const candidate = {
      year,
      grade,
      subject,
      overallPercent: percent(item.overallPercent),
      masteryPercent: percent(item.masteryPercent),
      testedCount: count(item.testedCount),
      absentCount: count(item.absentCount),
      domains: namedPercents(item.domains, 12),
      levels: namedPercents(item.levels, 6),
    };
    const parsed = baselineSchema.safeParse(candidate);
    if (!parsed.success) continue;
    const b = parsed.data;
    const empty = b.overallPercent === null && b.masteryPercent === null && b.testedCount === null && b.absentCount === null && !b.domains.length && !b.levels.length;
    if (empty) continue;
    const key = keyOf(b);
    const existing = byKey.get(key);
    byKey.set(key, existing ? merge(existing, b) : b);
  }

  const baselines = Array.from(byKey.values()).sort(
    (a, b) => b.year - a.year || b.grade - a.grade || NAFS_SUBJECTS.indexOf(a.subject) - NAFS_SUBJECTS.indexOf(b.subject)
  );

  // Sanity checks the principal should see; values are kept as read.
  for (const b of baselines) {
    if (b.levels.length >= 3) {
      const total = Math.round(b.levels.reduce((sum, l) => sum + l.percent, 0) * 10) / 10;
      if (total < 97 || total > 103) warnings.push(`مجموع نسب المستويات في ${b.subject} ${b.year} = ${total}%، تحقق منها.`);
    }
  }

  return { isReport: true, baselines, warnings: Array.from(new Set(warnings)).slice(0, MAX_WARNINGS) };
}
