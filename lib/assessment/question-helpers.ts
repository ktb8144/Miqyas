// Shared helpers for reading per-question results.

/** Supabase may return a joined row as an object or a one-item array. */
export function firstJoin<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

/**
 * The misconception an answer option encodes, from `package_questions.misconceptions_json`
 * (an object keyed by option letter). Returns null when none is recorded.
 */
export function misconceptionForOption(misconceptions: unknown, selectedOption: string | null | undefined) {
  if (!selectedOption || !misconceptions || typeof misconceptions !== "object" || Array.isArray(misconceptions)) return null;
  const map = misconceptions as Record<string, unknown>;
  const option = selectedOption.trim();
  const value = map[option] ?? map[`option_${option}`];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

const MISCONCEPTION_OPTIONS = ["أ", "ب", "ج", "د"];

/**
 * Reads the optional `misconceptions` object of one answer-key question (wrong option letter →
 * the misconception that leads a student to it) into the shape `package_questions.misconceptions_json`
 * stores. Accepts "أ" or "option_أ" keys. Returns an error message instead of throwing so the admin
 * validator and the server importer can each raise their own error type.
 */
export function parseAnswerKeyMisconceptions(
  value: unknown,
  correctAnswer: string,
  questionNumber: number,
): { value: Record<string, string> | null; error?: undefined } | { value?: undefined; error: string } {
  if (value === undefined || value === null) return { value: null };
  if (typeof value !== "object" || Array.isArray(value)) {
    return { error: `السؤال رقم ${questionNumber}: الحقل misconceptions يجب أن يكون كائنًا مفاتيحه أ أو ب أو ج أو د.` };
  }
  const result: Record<string, string> = {};
  for (const [rawKey, rawText] of Object.entries(value as Record<string, unknown>)) {
    const key = rawKey.trim().replace(/^option_/, "");
    if (!MISCONCEPTION_OPTIONS.includes(key)) {
      return { error: `السؤال رقم ${questionNumber}: المفتاح "${rawKey}" في misconceptions يجب أن يكون أ أو ب أو ج أو د.` };
    }
    if (key === correctAnswer) {
      return { error: `السؤال رقم ${questionNumber}: الخيار ${key} هو الإجابة الصحيحة، فلا يُكتب له مفهوم خاطئ. راجع الإجابة أو التحليل.` };
    }
    if (rawText === null || rawText === undefined) continue;
    if (typeof rawText !== "string") {
      return { error: `السؤال رقم ${questionNumber}: وصف المفهوم الخاطئ للخيار ${key} يجب أن يكون نصًا.` };
    }
    if (rawText.trim()) result[key] = rawText.trim();
  }
  return { value: Object.keys(result).length ? result : null };
}

/**
 * Parses answer-key JSON text pasted or loaded by an admin. Tolerates what copying often adds
 * (a byte-order mark, a ```json fence, curly quotes, invisible direction marks, trailing commas),
 * and when the text still is not JSON, says where and why in Arabic instead of a bare
 * "invalid JSON".
 */
export function parseAnswerKeyJsonText(raw: string): { value: unknown; error?: undefined } | { value?: undefined; error: string } {
  let text = raw.replace(/^﻿/, "").trim();
  const fence = text.match(/^```[a-zA-Z]*\s*([\s\S]*?)\s*```$/);
  if (fence) text = fence[1].trim();
  if (!text) return { error: "لم يُلصق شيء. ارفع ملف المفتاح أو ألصق محتواه." };

  let firstError: unknown;
  try {
    return { value: JSON.parse(text) };
  } catch (err) {
    firstError = err;
  }
  const repaired = text
    .replace(/[‎‏‪-‮⁦-⁩]/g, "")
    .replace(/[“”„‟″]/g, '"')
    .replace(/,\s*([}\]])/g, "$1");
  try {
    return { value: JSON.parse(repaired) };
  } catch {
    // fall through to a description of the original text's problem
  }

  const first = text[0];
  if (first !== "{" && first !== "[") {
    return { error: `النص لا يبدأ بـ { كما يبدأ ملف المفتاح، بل يبدأ بـ «${text.slice(0, 20)}». ارفع ملف ‎.json‎ نفسه بزر «اختيار ملف المفتاح».` };
  }
  const last = text[text.length - 1];
  if (last !== "}" && last !== "]") {
    return { error: `النص ناقص: ينتهي بـ «${text.slice(-20)}» لا بـ }. يبدو أن جزءًا منه لم يُنسخ؛ ارفع الملف نفسه بزر «اختيار ملف المفتاح».` };
  }
  const message = firstError instanceof Error ? firstError.message : "";
  const lineCol = message.match(/line (\d+) column (\d+)/);
  const position = message.match(/position (\d+)/);
  let at: number | null = position ? Number(position[1]) : null;
  if (at === null && lineCol) {
    const lines = text.split("\n");
    at = lines.slice(0, Number(lineCol[1]) - 1).reduce((sum, line) => sum + line.length + 1, 0) + Number(lineCol[2]) - 1;
  }
  if (at === null) return { error: "صيغة JSON غير صحيحة. ارفع ملف المفتاح نفسه بزر «اختيار ملف المفتاح» بدل النسخ واللصق." };
  const line = text.slice(0, at).split("\n").length;
  const snippet = text.slice(Math.max(0, at - 25), at + 15).replace(/\s+/g, " ");
  return { error: `صيغة JSON غير صحيحة في السطر ${line}، قرب: «${snippet}». ارفع ملف المفتاح نفسه بزر «اختيار ملف المفتاح» بدل النسخ واللصق.` };
}
