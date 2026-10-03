/** Rounded mean, or null for an empty list. */
export function average(values: number[]): number | null {
  if (!values.length) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

/** Any stored percentage (number / numeric string / null) → rounded number, 0 if invalid. */
export function toPercent(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.round(numeric) : 0;
}

/** part / total as a rounded percentage, 0 when total is 0. */
export function percentOf(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}
