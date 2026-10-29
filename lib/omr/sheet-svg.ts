import { buildStandardLayout, MAX_STUDENT_CODE } from "./standard-sheet";

/** Draws Dala's standard answer block as SVG (millimetre units). Used by the print page and the reader tests. */

const MARGIN = 6;
const INK = "#111";
const OUTLINE = "#444";
const MUTED = "#555";

const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

function arabicNumber(value: number) {
  return String(value).replace(/[0-9]/g, (digit) => ARABIC_DIGITS[Number(digit)]);
}

export type AnswerBlockOptions = {
  questionCount: number;
  /** The test's id; sets the identity strip. */
  seed: string;
  /** Pre-shade this student number (personal sheets). */
  studentCode?: number | null;
};

export function answerBlockSize(questionCount: number, seed: string) {
  const { template } = buildStandardLayout(questionCount, seed);
  return { widthMm: template.width + MARGIN * 2, heightMm: template.height + MARGIN * 2 };
}

export function renderAnswerBlockSvg({ questionCount, seed, studentCode }: AnswerBlockOptions) {
  const layout = buildStandardLayout(questionCount, seed);
  const { template } = layout;
  const w = template.width;
  const h = template.height;
  const r = template.bubbleRadius;
  const half = template.markerSize / 2;
  const parts: string[] = [];

  const vbW = w + MARGIN * 2;
  const vbH = h + MARGIN * 2;
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-MARGIN} ${-MARGIN} ${vbW} ${vbH}" width="${vbW}mm" height="${vbH}mm" font-family="Tahoma, Arial, sans-serif">`
  );
  parts.push(`<rect x="${-MARGIN}" y="${-MARGIN}" width="${vbW}" height="${vbH}" fill="#fff"/>`);

  // Corner markers.
  for (const [x, y] of [[0, 0], [w, 0], [w, h], [0, h]]) {
    parts.push(`<rect x="${x - half}" y="${y - half}" width="${template.markerSize}" height="${template.markerSize}" fill="${INK}"/>`);
  }

  // Orientation bar.
  const mark = template.orientationMark;
  if (mark) parts.push(`<rect x="${mark.x}" y="${mark.y}" width="${mark.w}" height="${mark.h}" fill="${INK}"/>`);

  // Identity strip (only the "1" cells are printed).
  const strip = template.idStrip;
  if (strip) {
    strip.cells.forEach((cell, index) => {
      if (layout.idBits[index]) {
        const s = strip.cellSize;
        parts.push(`<rect x="${cell.x - s / 2}" y="${cell.y - s / 2}" width="${s}" height="${s}" fill="${INK}"/>`);
      }
    });
  }

  const circle = (x: number, y: number, filled = false) =>
    `<circle cx="${x}" cy="${y}" r="${r}" fill="${filled ? INK : "#fff"}" stroke="${OUTLINE}" stroke-width="0.4"/>`;
  const text = (x: number, y: number, value: string, size: number, weight = 400, anchor = "middle", color = INK) =>
    `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" dominant-baseline="central" fill="${color}">${value}</text>`;

  // Student number grid.
  const code = template.studentCode;
  if (code) {
    const valid = studentCode && studentCode > 0 && studentCode <= MAX_STUDENT_CODE ? studentCode : null;
    const ones = valid ? valid % 10 : -1;
    const tens = valid ? Math.floor(valid / 10) : -1;
    code.ones.bubbles.forEach((bubble, digit) => {
      parts.push(text(bubble.x, 5.6, arabicNumber(digit), 2.8, 700, "middle", MUTED));
      parts.push(circle(bubble.x, bubble.y, digit === ones));
    });
    code.tens.bubbles.forEach((bubble, digit) => parts.push(circle(bubble.x, bubble.y, digit === tens)));
    parts.push(text(w - 5, code.ones.bubbles[0].y, "الآحاد", 3, 700, "end"));
    parts.push(text(w - 5, code.tens.bubbles[0].y, "العشرات", 3, 700, "end"));

    // Box where the student also writes the number (for the teacher, not the reader).
    parts.push(`<rect x="10" y="6.5" width="34" height="18" rx="1.5" fill="#fff" stroke="${MUTED}" stroke-width="0.3" stroke-dasharray="1 0.8"/>`);
    parts.push(text(27, 10, "اكتب رقمك هنا", 2.6, 700, "middle", MUTED));
    parts.push(`<line x1="4" y1="26.5" x2="${w - 4}" y2="26.5" stroke="#bbb" stroke-width="0.25"/>`);
  }

  // Answer columns.
  layout.labelX.forEach((labelX) => {
    const firstBubbleX = labelX - 10;
    ["أ", "ب", "ج", "د"].forEach((letter, option) => {
      parts.push(text(firstBubbleX - option * 8, layout.lettersY, letter, 3.2, 700, "middle", MUTED));
    });
  });
  template.questions.forEach((question, index) => {
    const column = Math.floor(index / layout.rowsPerColumn);
    parts.push(text(layout.labelX[column], question.bubbles[0].y, arabicNumber(index + 1), 3.4, 700));
    question.bubbles.forEach((bubble) => parts.push(circle(bubble.x, bubble.y)));
  });

  parts.push("</svg>");
  return parts.join("");
}
