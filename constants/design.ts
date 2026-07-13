import type { ThemeMode } from "@/lib/utils/time-wisdom";

// Light palette matches the "4a — Final design" tokens exactly
// (.agents/claudedesign/design_handoff_adhd_redesign/README.md).
const lightColors = {
  background: "#F7F4EF",
  surface: "#FFFEFB",
  surfaceMuted: "#F7F4EF",
  text: "#1C1B18",
  textMuted: "#7D766B",
  textFaint: "#A39B8D",
  border: "#E6E0D5",
  borderStrong: "#C9C2B4",
  accent: "#9C5B3F",
  accentPressed: "#7F4A34",
  accentSoft: "#F0E2DA",
  accentSoftText: "#7A4128",
  accentText: "#FFFFFF",
  danger: "#A14B3F",
  dangerSoft: "#F5E6E2",
  barMuted: "#E3CABC",
  barHighlight: "#9C5B3F",
  overlay: "rgba(20, 15, 10, 0.5)",
  focusBackground: "#1C1B18",
  focusSheetBackground: "#2A221C",
  focusReviewBanner: "#2A221C",
  focusReviewBannerText: "#E9C9B4",
  focusText: "#FFFFFF",
  focusMuted: "#8F887B",
  focusFaint: "#6F695F",
  focusAccent: "#E0A458",
} as const;

// Dark app theme: the README only specifies the light palette (plus the
// always-dark focus timer surfaces, which live under `focus*` above and stay
// the same in both modes). This dark theme adapts the same warm/terracotta
// hue family for a dark background so `Appearance: Dark` remains usable.
const darkColors = {
  background: "#17120F",
  surface: "#221A16",
  surfaceMuted: "#2B211C",
  text: "#FFF9F4",
  textMuted: "#C0B3A9",
  textFaint: "#8C7F77",
  border: "#3B2E27",
  borderStrong: "#4E3D33",
  accent: "#C97955",
  accentPressed: "#B36848",
  accentSoft: "#4B3025",
  accentSoftText: "#E9B79B",
  accentText: "#FFFFFF",
  danger: "#EF8F7D",
  dangerSoft: "#3B241F",
  barMuted: "#4B3025",
  barHighlight: "#C97955",
  overlay: "rgba(8, 5, 4, 0.74)",
  focusBackground: "#110D0B",
  focusSheetBackground: "#2A221C",
  focusReviewBanner: "#2A221C",
  focusReviewBannerText: "#E9C9B4",
  focusText: "#FFFDFC",
  focusMuted: "#998B82",
  focusFaint: "#6F695F",
  focusAccent: "#E0A458",
} as const;

export const design = {
  colors: {
    light: lightColors,
    dark: darkColors,
  },
  // 8px base scale from the design spec: 4, 8, 12, 16, 20, 24, 32, 40, 48
  spacing: {
    xxs: 4,
    xs: 8,
    sm: 12,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 32,
    xxxl: 40,
    huge: 48,
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    pill: 999,
  },
  // Semantic type scale — values are font sizes in px; pair with the
  // matching weight noted in each comment when styling text.
  type: {
    screenTitle: 26, // weight 800
    cardTitle: 20, // weight 700
    taskRowTitle: 17, // weight 600
    body: 15, // weight 500
    meta: 13, // weight 400, textMuted
    sectionLabel: 12, // weight 700, uppercase, textMuted
    caption: 11, // weight 400
    countdown: 76, // weight 800, focus timer only
  },
  letterSpacing: {
    sectionLabel: 0.7, // ~0.06em at 12px
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
