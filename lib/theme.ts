// Single source of truth for brand colours.
// Used by tailwind.config.ts (as utility classes: bg-brand, text-level-basic, ...)
// and directly in inline styles / charts where a class can't be used.

export const COLORS = {
  brand: "#1D9E75",
  brandDark: "#158c63",
  navy: "#0b2447",
  advanced: "#7F77DD",
  proficient: "#1D9E75",
  basic: "#BA7517",
  below: "#E24B4A",
} as const;

export type ColorName = keyof typeof COLORS;
