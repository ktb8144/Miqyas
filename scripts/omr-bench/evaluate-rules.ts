// Outcome of every question by mark style, under Dala's shading rules (Nov 2026).
import { readFileSync } from "node:fs";
import jpeg from "jpeg-js";
import { readAnswerSheet } from "../../lib/omr/reader";
import { buildStandardTemplate } from "../../lib/omr/standard-sheet";

type Truth = { file: string; q: number; answers: Record<string, string>; styles: Record<string, string>; sheetSeed: string; expectSeed: string };
const dir = process.argv[2] ?? "test";
const truths: Truth[] = JSON.parse(readFileSync(`${dir}/truth.json`, "utf8"));
const by: Record<string, Record<string, number>> = {};
const decisions: Record<string, Record<string, number>> = {};
const examples: string[] = [];
for (const t of truths) {
  if (t.sheetSeed !== t.expectSeed) continue;
  const raw = jpeg.decode(readFileSync(`${dir}/${t.file}`), { useTArray: true });
  const reading = readAnswerSheet({ width: raw.width, height: raw.height, data: raw.data }, buildStandardTemplate(t.q, t.expectSeed));
  if (!reading.ok) continue;
  for (const [key, expected] of Object.entries(t.answers)) {
    const style = t.styles[key];
    const got = reading.answers[key];
    const letter = expected.replace("?", "");
    const outcome =
      got === "unclear" ? "teacher" :
      got === "blank" ? "blank" :
      got === "multiple" ? "multiple" :
      got === letter ? "intended letter" : "OTHER LETTER";
    (by[style] ??= {})[outcome] = (by[style][outcome] ?? 0) + 1;
    const decision = reading.questions.find((g) => g.key === key)!.decision;
    (decisions[style] ??= {})[decision] = (decisions[style][decision] ?? 0) + 1;
    if (outcome === "OTHER LETTER" && examples.length < 15) examples.push(`${t.file} ${key} ${style} expected=${expected} got=${got} fill=${JSON.stringify(reading.questions.find((g) => g.key === key)!.fill)}`);
  }
}
console.log(JSON.stringify({ outcomes: by, decisions }, null, 1));
console.log(examples.join("\n"));
