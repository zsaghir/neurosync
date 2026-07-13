import type { ThemeMode } from "@/lib/utils/time-wisdom";

const lightColors = {
  background: "#F8F5F0",
  surface: "#FFFDFA",
  surfaceMuted: "#F4EFE9",
  text: "#241E1A",
  textMuted: "#7A7068",
  textFaint: "#9B9189",
  border: "#E8E0D8",
  accent: "#AD6242",
  accentPressed: "#965238",
  accentSoft: "#F0DDD3",
  accentText: "#FFFFFF",
  danger: "#A54C3C",
  overlay: "rgba(29, 21, 17, 0.58)",
  focusBackground: "#1D1612",
  focusText: "#FFFDFC",
  focusMuted: "#81756D",
} as const;

const darkColors = {
  background: "#17120F",
  surface: "#221A16",
  surfaceMuted: "#2B211C",
  text: "#FFF9F4",
  textMuted: "#C0B3A9",
  textFaint: "#8C7F77",
  border: "#3B2E27",
  accent: "#C97955",
  accentPressed: "#B36848",
  accentSoft: "#4B3025",
  accentText: "#FFFFFF",
  danger: "#EF8F7D",
  overlay: "rgba(8, 5, 4, 0.74)",
  focusBackground: "#110D0B",
  focusText: "#FFFDFC",
  focusMuted: "#998B82",
} as const;

export const design = {
  colors: {
    light: lightColors,
    dark: darkColors,
  },
  spacing: {
    xxs: 4,
    xs: 8,
    sm: 12,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 32,
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 18,
    pill: 999,
  },
  type: {
    caption: 11,
    label: 12,
    body: 14,
    bodyLarge: 16,
    title: 26,
    hero: 30,
  },
  touchTarget: 44,
  contentMaxWidth: 520,
  shadow: {
    shadowColor: "#2A1E18",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
} as const;

export type AppColors = typeof lightColors | typeof darkColors;

export const getAppColors = (mode: ThemeMode): AppColors =>
  design.colors[mode];
