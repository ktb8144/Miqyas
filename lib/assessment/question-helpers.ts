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
