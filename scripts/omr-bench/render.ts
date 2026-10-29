// Renders blank answer blocks to PNG and writes their geometry for the synthetic-photo generator.
import { writeFileSync, mkdirSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";
import { renderAnswerBlockSvg, answerBlockSize } from "../../lib/omr/sheet-svg";
import { buildStandardTemplate } from "../../lib/omr/standard-sheet";

const PX_PER_MM = 12;
mkdirSync("blocks", { recursive: true });

const configs = [
  { q: 10, seed: "pkg-A" },
  { q: 12, seed: "pkg-A" },
  { q: 12, seed: "pkg-B" },
  { q: 20, seed: "pkg-A" },
  { q: 30, seed: "pkg-A" },
  { q: 5, seed: "pkg-A" },
];

const out: unknown[] = [];
for (const { q, seed } of configs) {
  for (const prefill of [null, 23]) {
    const svg = renderAnswerBlockSvg({ questionCount: q, seed, studentCode: prefill });
    const size = answerBlockSize(q, seed);
    const png = new Resvg(svg, {
      fitTo: { mode: "width", value: Math.round(size.widthMm * PX_PER_MM) },
      font: { loadSystemFonts: true, defaultFontFamily: "DejaVu Sans" },
    }).render().asPng();
    const name = `q${q}-${seed}-${prefill ?? "blank"}`;
    writeFileSync(`blocks/${name}.png`, png);
    const template = buildStandardTemplate(q, seed);
    out.push({ name, q, seed, prefill, pxPerMm: PX_PER_MM, marginMm: 6, size, template });
  }
}
writeFileSync("blocks/index.json", JSON.stringify(out, null, 1));
console.log("rendered", out.length);
