// Single source of truth for brand colours.
// - Tailwind classes:  bg-brand, text-brand-navy, border-level-basic, ...
// - Inline styles / charts (where a class can't be used): COLORS.brand, ...
// Never hard-code these hex values in components.

const BRAND = "#159f91";
const ACCENT = "#7F77DD";
const WARNING = "#BA7517";
const DANGER = "#E24B4A";
const SUCCESS = "#1D9E75";

export const COLORS = {
  brand: BRAND,
  brandDark: "#10877b",
  navy: "#0b2447",
  navyLight: "#12345f",
  accent: ACCENT,
  success: SUCCESS,
  warning: WARNING,
  danger: DANGER,
  // Performance levels (see lib/levels.ts)
  advanced: ACCENT,
  proficient: SUCCESS,
  basic: WARNING,
  below: DANGER,
} as const;

export type ColorName = keyof typeof COLORS;
