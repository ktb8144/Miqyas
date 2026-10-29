import type { OmrChoiceGroup, OmrTemplate, Point } from "./types";

/**
 * Dala's standard answer block.
 *
 * Geometry (mm, from the top-left marker centre):
 *   - Student number: ones row then tens row (0–4, so classes up to 49), shaded right-to-left.
 *   - Answers: up to 10 rows per column, columns right-to-left, options أ ب ج د right-to-left.
 *   - Orientation bar on the top edge near the right marker.
 *   - Ten-cell test-identity strip on the bottom edge.
 *
 * Changing any number here changes how printed sheets are read. Bump STANDARD_SHEET_VERSION
 * whenever the layout changes so old printouts are not read with the new geometry.
 */
export const STANDARD_SHEET_VERSION = 1;

export const ANSWER_OPTIONS = ["أ", "ب", "ج", "د"] as const;
export const MAX_SHEET_QUESTIONS = 30;
export const MAX_STUDENT_CODE = 49;

const WIDTH = 170;
const MARKER = 8;
const BUBBLE_R = 2.6;
const PITCH_X = 8;
const PITCH_Y = 8;
const MAX_ROWS = 10;
const COLUMN_PITCH = 50;

const CODE_ONES_Y = 11;
const CODE_TENS_Y = 20;
const CODE_FIRST_X = WIDTH - 40;

const LETTERS_Y = 31;
const FIRST_ROW_Y = 37;

const ID_BITS = 10;
const ID_FIRST_X = 58;
const ID_PITCH = 7;
const ID_CELL = 4;

export type StandardLayout = {
  template: OmrTemplate;
  columns: number;
  rowsPerColumn: number;
  /** x of each column's question-number label. */
  labelX: number[];
  codeLabelX: number;
  lettersY: number;
  idBits: number[];
};

function digitsGroup(key: string, y: number, count: number): OmrChoiceGroup {
  const options: string[] = [];
  const bubbles: Point[] = [];
  for (let digit = 0; digit < count; digit++) {
    options.push(String(digit));
    bubbles.push({ x: CODE_FIRST_X - digit * PITCH_X, y });
  }
  return { key, options, bubbles };
}

/** 10-bit identity of a test, taken from its id. Never all-zero, so a blank strip never matches. */
export function sheetIdBits(seed: string): number[] {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  let value = hash % 1023 + 1; // 1…1023
  const bits: number[] = [];
  for (let i = 0; i < ID_BITS; i++) {
    bits.push(value & 1);
    value >>= 1;
  }
  return bits;
}

export function standardTemplateId(questionCount: number, seed: string) {
  return `dala-std-v${STANDARD_SHEET_VERSION}-q${questionCount}-${sheetIdBits(seed).join("")}`;
}

/**
 * Builds the standard template for a test.
 * @param questionCount number of questions (1–30)
 * @param seed the test's id; drives the identity strip
 */
export function buildStandardLayout(questionCount: number, seed: string): StandardLayout {
  const count = Math.max(1, Math.min(MAX_SHEET_QUESTIONS, Math.round(questionCount)));
  const columns = Math.ceil(count / MAX_ROWS);
  const rowsPerColumn = Math.ceil(count / columns);

  // Columns are centred in the block; the first column sits on the right.
  const firstLabelX = WIDTH / 2 + ((columns - 1) * COLUMN_PITCH) / 2 + 17;
  const labelX = Array.from({ length: columns }, (_, column) => firstLabelX - column * COLUMN_PITCH);

  const questions: OmrChoiceGroup[] = [];
  for (let index = 0; index < count; index++) {
    const column = Math.floor(index / rowsPerColumn);
    const row = index % rowsPerColumn;
    const y = FIRST_ROW_Y + row * PITCH_Y;
    const firstBubbleX = labelX[column] - 10;
    questions.push({
      key: `q${index + 1}`,
      options: [...ANSWER_OPTIONS],
      bubbles: ANSWER_OPTIONS.map((_, option) => ({ x: firstBubbleX - option * PITCH_X, y })),
    });
  }

  const height = FIRST_ROW_Y + (rowsPerColumn - 1) * PITCH_Y + 9;
  const idBits = sheetIdBits(seed);

  const template: OmrTemplate = {
    id: standardTemplateId(count, seed),
    width: WIDTH,
    height,
    markerSize: MARKER,
    bubbleRadius: BUBBLE_R,
    questions,
    studentCode: {
      ones: digitsGroup("code_ones", CODE_ONES_Y, 10),
      tens: digitsGroup("code_tens", CODE_TENS_Y, Math.floor(MAX_STUDENT_CODE / 10) + 1),
    },
    orientationMark: { x: WIDTH - 36, y: -1.5, w: 20, h: 3 },
    idStrip: {
      cellSize: ID_CELL,
      bits: idBits,
      cells: Array.from({ length: ID_BITS }, (_, bit) => ({ x: ID_FIRST_X + bit * ID_PITCH, y: height })),
    },
  };

  return { template, columns, rowsPerColumn, labelX, codeLabelX: WIDTH - 12, lettersY: LETTERS_Y, idBits };
}

export function buildStandardTemplate(questionCount: number, seed: string): OmrTemplate {
  return buildStandardLayout(questionCount, seed).template;
}
