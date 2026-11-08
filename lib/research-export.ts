import { randomBytes, randomInt } from "node:crypto";

/**
 * Builds the de-identified research files from internal rows (see research_responses in the database).
 *
 *   * Every school, class and student gets a random code that exists only in this export: no key is kept,
 *     so codes can't be linked back to anyone, nor between two exports.
 *   * Classes with fewer than `minCell` included students are dropped entirely.
 *   * Aggregate cells and NAFS rows with fewer than `minCell` students are dropped.
 *   * No names, no school name or city, no dates finer than the assessment week.
 */

export type ResearchResponseRow = {
  response_id: string;
  school_id: string;
  school_kind: string | null;
  school_stage: string | null;
  school_gender: string | null;
  class_id: string | null;
  student_id: string;
  grade: number | null;
  subject: string | null;
  package_id: string | null;
  assessment_code: string | null;
  week_number: number | null;
  question_number: number | null;
  difficulty: string | null;
  domain: string | null;
  skill: string | null;
  selected_option: string | null;
  correct_option: string | null;
  is_correct: boolean | null;
  mark_status: string | null;
};

export type ResearchSchool = { id: string; kind: string | null; stage: string | null; gender: string | null };

export type ResearchNafsRow = {
  school_id: string;
  year: number;
  grade: number;
  subject: string;
  overall_percent: number | string | null;
  mastery_percent: number | string | null;
  tested_count: number | null;
  domains: unknown;
};

export type ResearchStats = {
  schools: number;
  students: number;
  responseRows: number;
  suppressedClasses: number;
  suppressedCells: number;
  suppressedNafsRows: number;
};

type Cell = string | number | boolean | null | undefined;

export function toCsv(head: string[], rows: Cell[][]) {
  const escape = (value: Cell) => {
    if (value === null || value === undefined) return "";
    const text = String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  // BOM so Excel opens Arabic text correctly.
  return "﻿" + [head, ...rows].map((row) => row.map(escape).join(",")).join("\r\n") + "\r\n";
}

function shuffle<T>(items: T[]) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function sequentialCodes(ids: Iterable<string>, prefix: string) {
  const list = shuffle(Array.from(new Set(ids)));
  const width = Math.max(2, String(list.length).length);
  return new Map(list.map((id, i) => [id, `${prefix}${String(i + 1).padStart(width, "0")}`]));
}

function randomCodes(ids: Iterable<string>, prefix: string) {
  const map = new Map<string, string>();
  const used = new Set<string>();
  for (const id of Array.from(new Set(ids))) {
    let code: string;
    do code = `${prefix}${randomBytes(5).toString("hex")}`;
    while (used.has(code));
    used.add(code);
    map.set(id, code);
  }
  return map;
}

const num = (value: number | string | null | undefined) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const STAGE_LABEL: Record<string, string> = { primary: "primary", intermediate: "intermediate", combined: "combined" };

export function buildResearchFiles(input: {
  responses: ResearchResponseRow[];
  schools: ResearchSchool[];
  nafs: ResearchNafsRow[];
  minCell: number;
  consentVersion: string;
  exportedOn: string;
}) {
  const { minCell } = input;

  // ── Drop small classes (counted by distinct included students) ───────────
  const groupKey = (row: ResearchResponseRow) => row.class_id ?? `noclass:${row.school_id}:${row.grade}:${row.subject}`;
  const studentsPerGroup = new Map<string, Set<string>>();
  for (const row of input.responses) {
    const key = groupKey(row);
    if (!studentsPerGroup.has(key)) studentsPerGroup.set(key, new Set());
    studentsPerGroup.get(key)!.add(row.student_id);
  }
  const keptGroups = new Set(Array.from(studentsPerGroup).filter(([, students]) => students.size >= minCell).map(([key]) => key));
  const suppressedClasses = studentsPerGroup.size - keptGroups.size;
  const responses = input.responses.filter((row) => keptGroups.has(groupKey(row)));

  // ── Codes that exist only in this export ─────────────────────────────────
  const nafsKept = input.nafs.filter((row) => (row.tested_count ?? 0) >= minCell);
  const schoolIds = new Set([...responses.map((r) => r.school_id), ...nafsKept.map((r) => r.school_id)]);
  const schoolCode = sequentialCodes(schoolIds, "S");
  const classCode = sequentialCodes(responses.map(groupKey), "C");
  const studentCode = randomCodes(responses.map((r) => r.student_id), "P");
  const schoolInfo = new Map(input.schools.map((s) => [s.id, s]));

  // ── responses.csv ─────────────────────────────────────────────────────────
  const responseHead = [
    "school_code", "school_type", "stage", "gender", "class_code", "student_code", "grade", "subject",
    "assessment_code", "week", "question", "difficulty", "domain", "skill", "selected", "correct_option", "is_correct", "mark_status",
  ];
  const responseRows = responses
    .map((r) => [
      schoolCode.get(r.school_id),
      r.school_kind === "individual" ? "independent_teacher" : "school",
      STAGE_LABEL[r.school_stage ?? ""] ?? "",
      r.school_gender ?? "",
      classCode.get(groupKey(r)),
      studentCode.get(r.student_id),
      r.grade,
      r.subject,
      r.assessment_code,
      r.week_number,
      r.question_number,
      r.difficulty,
      r.domain,
      r.skill,
      r.selected_option,
      r.correct_option,
      r.is_correct === null ? "" : r.is_correct ? 1 : 0,
      r.mark_status,
    ] as Cell[])
    // Sorted by codes, not by internal order, so row order reveals nothing.
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])) || String(a[4]).localeCompare(String(b[4])) || String(a[5]).localeCompare(String(b[5])) || Number(a[9] ?? 0) - Number(b[9] ?? 0) || Number(a[10] ?? 0) - Number(b[10] ?? 0));

  // ── skills_summary.csv (aggregate, small cells dropped) ───────────────────
  type Agg = { cells: Cell[]; students: Set<string>; responses: number; correct: number };
  const aggregates = new Map<string, Agg>();
  for (const r of responses) {
    const cells: Cell[] = [schoolCode.get(r.school_id), STAGE_LABEL[r.school_stage ?? ""] ?? "", r.school_gender ?? "", r.grade, r.subject, r.week_number, r.domain, r.skill];
    const key = JSON.stringify(cells);
    let agg = aggregates.get(key);
    if (!agg) aggregates.set(key, (agg = { cells, students: new Set(), responses: 0, correct: 0 }));
    agg.students.add(r.student_id);
    agg.responses++;
    if (r.is_correct) agg.correct++;
  }
  let suppressedCells = 0;
  const summaryRows: Cell[][] = [];
  for (const agg of Array.from(aggregates.values())) {
    if (agg.students.size < minCell) {
      suppressedCells++;
      continue;
    }
    summaryRows.push([...agg.cells, agg.students.size, agg.responses, agg.correct, Math.round((agg.correct / agg.responses) * 1000) / 10]);
  }
  summaryRows.sort((a, b) => String(a[0]).localeCompare(String(b[0])) || Number(a[3] ?? 0) - Number(b[3] ?? 0) || Number(a[5] ?? 0) - Number(b[5] ?? 0));

  // ── NAFS (school-level, as entered by the school) ─────────────────────────
  const nafsRows: Cell[][] = [];
  const nafsDomainRows: Cell[][] = [];
  for (const row of nafsKept) {
    const info = schoolInfo.get(row.school_id);
    const code = schoolCode.get(row.school_id);
    nafsRows.push([code, STAGE_LABEL[info?.stage ?? ""] ?? "", info?.gender ?? "", row.year, row.grade, row.subject, num(row.overall_percent), num(row.mastery_percent), row.tested_count]);
    if (Array.isArray(row.domains)) {
      for (const domain of row.domains as Array<{ name?: unknown; percent?: unknown }>) {
        if (typeof domain?.name !== "string") continue;
        nafsDomainRows.push([code, row.year, row.grade, row.subject, domain.name, num(domain.percent as number)]);
      }
    }
  }
  nafsRows.sort((a, b) => String(a[0]).localeCompare(String(b[0])) || Number(a[3]) - Number(b[3]));

  const stats: ResearchStats = {
    schools: schoolIds.size,
    students: studentCode.size,
    responseRows: responseRows.length,
    suppressedClasses,
    suppressedCells,
    suppressedNafsRows: input.nafs.length - nafsKept.length,
  };

  const readme = [
    "Dala (dalaedu.com) — de-identified research export",
    `Exported on: ${input.exportedOn}`,
    `Consent version: ${input.consentVersion}`,
    `Minimum group size: ${minCell}`,
    "",
    `Schools: ${stats.schools} | Students: ${stats.students} | Responses: ${stats.responseRows}`,
    `Dropped: ${stats.suppressedClasses} classes under ${minCell} students, ${stats.suppressedCells} summary cells under ${minCell} students, ${stats.suppressedNafsRows} NAFS rows under ${minCell} tested.`,
    "",
    "Included: only schools that opted in to research with the current consent version; students whose parents excluded them are left out.",
    "Codes (S.., C.., P..) are random and exist only in this export. No key is kept, so they cannot be linked to people or to other exports.",
    "Never included: names, student numbers, teacher names, school name or city, contact details, dates finer than the assessment week.",
    "",
    "responses.csv — one row per student answer",
    "  school_type: school | independent_teacher; stage: primary | intermediate | combined; gender: boys | girls",
    "  selected: chosen option, or blank / multiple / unclear; is_correct: 1 or 0",
    "  mark_status: how the bubble was read (ok, partial = half-shaded counted, multiple, blank, uncertain, manual ...)",
    "skills_summary.csv — per school code, grade, subject, week and skill: students, responses, correct, correct_percent",
    "nafs_baselines.csv — previous NAFS results entered by the school (school level)",
    "nafs_domains.csv — NAFS domain percentages for the same rows",
  ].join("\r\n");

  const files: Record<string, string> = {
    "README.txt": readme + "\r\n",
    "responses.csv": toCsv(responseHead, responseRows),
    "skills_summary.csv": toCsv(
      ["school_code", "stage", "gender", "grade", "subject", "week", "domain", "skill", "students", "responses", "correct", "correct_percent"],
      summaryRows
    ),
    "nafs_baselines.csv": toCsv(["school_code", "stage", "gender", "year", "grade", "subject", "overall_percent", "mastery_percent", "tested_count"], nafsRows),
    "nafs_domains.csv": toCsv(["school_code", "year", "grade", "subject", "domain", "percent"], nafsDomainRows),
  };

  return { files, stats };
}
