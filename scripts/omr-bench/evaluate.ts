// Runs the reader on synthetic photos and counts silent errors (wrong value with confidence).
import { readFileSync, writeFileSync } from "node:fs";
import jpeg from "jpeg-js";
import { readAnswerSheet } from "../../lib/omr/reader";
import { buildStandardTemplate } from "../../lib/omr/standard-sheet";

type Truth = {
  file: string; q: number; answers: Record<string, string>; styles: Record<string, string>;
  code: string; code_style: string; sheetSeed: string; expectSeed: string; upside: boolean;
};

const dir = process.argv[2] ?? "dev";
const truths: Truth[] = JSON.parse(readFileSync(`${dir}/truth.json`, "utf8"));
const stats = {
  sheets: 0, rejected: 0, rejectedReasons: {} as Record<string, number>,
  wrongSheetCaught: 0, wrongSheetMissed: 0, wrongSheetWarned: 0,
  questions: 0, auto: 0, flagged: 0, silent: 0,
  codeOk: 0, codeFlag: 0, codeSilent: 0, codeBlankSeen: 0,
  byStyle: {} as Record<string, { n: number; auto: number; flag: number; silent: number }>,
};
const silentLog: string[] = [];
let ms = 0;

for (const t of truths) {
  const raw = jpeg.decode(readFileSync(`${dir}/${t.file}`), { useTArray: true });
  const template = buildStandardTemplate(t.q, t.expectSeed);
  const started = performance.now();
  const reading = readAnswerSheet({ width: raw.width, height: raw.height, data: raw.data }, template);
  ms += performance.now() - started;
  stats.sheets++;
  const wrongSheet = t.sheetSeed !== t.expectSeed;
  if (!reading.ok) {
    stats.rejected++;
    stats.rejectedReasons[reading.reason] = (stats.rejectedReasons[reading.reason] ?? 0) + 1;
    if (wrongSheet && reading.reason === "wrong_sheet") stats.wrongSheetCaught++;
    else if (!wrongSheet) silentLog.push(`${t.file}: rejected ${reading.reason}`);
    continue;
  }
  if (wrongSheet) {
    if (reading.warnings.length) stats.wrongSheetWarned++;
    else { stats.wrongSheetMissed++; silentLog.push(`${t.file}: WRONG SHEET NOT CAUGHT`); }
    continue;
  }
  for (const [key, expected] of Object.entries(t.answers)) {
    const style = t.styles[key];
    const s = (stats.byStyle[style] ??= { n: 0, auto: 0, flag: 0, silent: 0 });
    const got = reading.answers[key];
    stats.questions++; s.n++;
    const optional = expected.endsWith("?");
    const letter = expected.replace("?", "");
    if (got === "unclear") { stats.flagged++; s.flag++; continue; }
    const correct = optional ? got === letter : got === expected;
    if (correct) { stats.auto++; s.auto++; }
    else {
      stats.silent++; s.silent++;
      const fill = reading.questions.find((g) => g.key === key)?.fill;
      silentLog.push(`${t.file} ${key} style=${style} expected=${expected} got=${got} fill=${JSON.stringify(fill)}`);
    }
  }
  if (reading.studentCode) {
    if (reading.studentCode === t.code) stats.codeOk++;
    else { stats.codeSilent++; silentLog.push(`${t.file} code expected=${t.code} got=${reading.studentCode}`); }
  } else if (t.code === "") stats.codeBlankSeen++;
  else stats.codeFlag++;
}

const report = { ...stats, msPerSheet: Math.round(ms / Math.max(1, stats.sheets)) };
console.log(JSON.stringify(report, null, 1));
console.log(silentLog.slice(0, 40).join("\n"));
writeFileSync(`${dir}/report.json`, JSON.stringify({ report, silentLog }, null, 1));
