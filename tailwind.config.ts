import type { Config } from "tailwindcss";
import { COLORS } from "./lib/theme";

// Brand colours live under their own names (brand, level-*) so they extend
// Tailwind's palette instead of replacing it. Do NOT add keys such as
// `amber` or `purple` here: a plain string would wipe out the whole default
// scale (amber-50 … amber-900) and silently break those classes.
const config: Config = {
  content: [
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: COLORS.brand,
          dark: COLORS.brandDark,
          navy: COLORS.navy,
          "navy-light": COLORS.navyLight,
        },
        accent: COLORS.accent,
        success: COLORS.success,
        warning: COLORS.warning,
        danger: COLORS.danger,
        level: {
          advanced: COLORS.advanced,
          proficient: COLORS.proficient,
          basic: COLORS.basic,
          below: COLORS.below,
        },
      },
    },
  },
  plugins: [],
};

export default config;
