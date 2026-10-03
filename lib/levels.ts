import { COLORS } from "@/lib/theme";

/**
 * Performance levels (ETEC bands) — the ONE place where the thresholds live.
 * Every page, API route and report must use these helpers instead of
 * hard-coding 90 / 70 / 50.
 */
export const LEVEL_THRESHOLDS = {
  advanced: 90,
  proficient: 70,
  basic: 50,
} as const;

/** A student / class / skill counts as "mastered" from this percentage. */
export const MASTERY_THRESHOLD = LEVEL_THRESHOLDS.proficient;

export type LevelName = "متقدم" | "متمكن" | "أساسي" | "دون الأساسي";

export const ETEC_LEVELS: Record<
  LevelName,
  { min: number; max: number; color: string; bg: string; text: string; border: string }
> = {
  متقدم: { min: 90, max: 100, color: COLORS.advanced, bg: "bg-purple-100", text: "text-purple-700", border: "border-purple-300" },
  متمكن: { min: 70, max: 89, color: COLORS.proficient, bg: "bg-green-100", text: "text-green-700", border: "border-green-300" },
  أساسي: { min: 50, max: 69, color: COLORS.basic, bg: "bg-amber-100", text: "text-amber-700", border: "border-amber-300" },
  "دون الأساسي": { min: 0, max: 49, color: COLORS.below, bg: "bg-red-100", text: "text-red-700", border: "border-red-300" },
};

export function getLevelFromPercentage(pct: number): LevelName {
  if (pct >= LEVEL_THRESHOLDS.advanced) return "متقدم";
  if (pct >= LEVEL_THRESHOLDS.proficient) return "متمكن";
  if (pct >= LEVEL_THRESHOLDS.basic) return "أساسي";
  return "دون الأساسي";
}

export function getLevel(score: number, total: number): LevelName {
  if (!total) return "دون الأساسي";
  return getLevelFromPercentage((score / total) * 100);
}

export function isLevelName(value: unknown): value is LevelName {
  return typeof value === "string" && value in ETEC_LEVELS;
}

/** Colour for a percentage, using the same bands as getLevel. */
export function levelColor(pct: number): string {
  return ETEC_LEVELS[getLevelFromPercentage(pct)].color;
}

/** Colour for a stored level label (falls back to the "below" colour). */
export function levelColorByName(level?: string | null): string {
  return isLevelName(level) ? ETEC_LEVELS[level].color : COLORS.below;
}
