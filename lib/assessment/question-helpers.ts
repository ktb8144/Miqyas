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
