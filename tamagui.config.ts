import { defaultConfig } from "@tamagui/config/v5";
import { createTamagui, createTokens } from "tamagui";
import { design } from "@/constants/design";

// Color tokens sourced from constants/design.ts (the single source of truth
// for the "4a — Final design" palette) so Tamagui primitives (XStack, YStack,
// Button, Card, Input, ...) and the existing useAppTheme() hook always agree.
const customTokens = createTokens({
  color: {
    background: design.colors.light.background,
    surface: design.colors.light.surface,
    surfaceMuted: design.colors.light.surfaceMuted,
    text: design.colors.light.text,
    textMuted: design.colors.light.textMuted,
    textFaint: design.colors.light.textFaint,
    border: design.colors.light.border,
    borderStrong: design.colors.light.borderStrong,
    accent: design.colors.light.accent,
    accentPressed: design.colors.light.accentPressed,
    accentSoft: design.colors.light.accentSoft,
    accentSoftText: design.colors.light.accentSoftText,
    accentText: design.colors.light.accentText,
    danger: design.colors.light.danger,
    dangerSoft: design.colors.light.dangerSoft,
    barMuted: design.colors.light.barMuted,
    barHighlight: design.colors.light.barHighlight,
    focusBackground: design.colors.light.focusBackground,
    focusText: design.colors.light.focusText,
    focusMuted: design.colors.light.focusMuted,
    focusFaint: design.colors.light.focusFaint,
    focusAccent: design.colors.light.focusAccent,
  },
  radius: {
    ...defaultConfig.tokens.radius,
    sm: design.radius.sm,
    md: design.radius.md,
    lg: design.radius.lg,
    pill: design.radius.pill,
  },
  space: {
    ...defaultConfig.tokens.space,
    xxs: design.spacing.xxs,
    xs: design.spacing.xs,
    sm: design.spacing.sm,
    md: design.spacing.md,
    lg: design.spacing.lg,
    xl: design.spacing.xl,
    xxl: design.spacing.xxl,
    xxxl: design.spacing.xxxl,
    huge: design.spacing.huge,
  },
  zIndex: defaultConfig.tokens.zIndex,
  size: defaultConfig.tokens.size,
});

const baseLightTheme = defaultConfig.themes.light;
const baseDarkTheme = defaultConfig.themes.dark;

function buildTheme(
  base: typeof baseLightTheme,
  colors: (typeof design.colors)["light"] | (typeof design.colors)["dark"],
) {
  return {
    ...base,
    background: colors.background,
    backgroundHover: colors.surface,
    backgroundPress: colors.surfaceMuted,
    backgroundFocus: colors.surface,
    color: colors.text,
    colorHover: colors.text,
    colorPress: colors.text,
    colorFocus: colors.text,
    borderColor: colors.border,
    borderColorHover: colors.borderStrong,
    borderColorPress: colors.accent,
    borderColorFocus: colors.accent,
    placeholderColor: colors.textMuted,
    // Custom semantic keys, referenced as $surface / $accent / etc.
    surface: colors.surface,
    surfaceMuted: colors.surfaceMuted,
    textMuted: colors.textMuted,
    textFaint: colors.textFaint,
    borderStrong: colors.borderStrong,
    accent: colors.accent,
    accentPressed: colors.accentPressed,
    accentSoft: colors.accentSoft,
    accentSoftText: colors.accentSoftText,
    accentText: colors.accentText,
    danger: colors.danger,
    dangerSoft: colors.dangerSoft,
    barMuted: colors.barMuted,
    barHighlight: colors.barHighlight,
  };
}

const config = {
  ...defaultConfig,
  tokens: customTokens,
  themes: {
    ...defaultConfig.themes,
    light: buildTheme(baseLightTheme, design.colors.light),
    dark: buildTheme(baseDarkTheme, design.colors.dark),
    // Always-dark surface for the full-screen focus timer, independent of
    // the app's light/dark appearance setting.
    focus: {
      ...baseDarkTheme,
      background: design.colors.light.focusBackground,
      color: design.colors.light.focusText,
      textMuted: design.colors.light.focusMuted,
      textFaint: design.colors.light.focusFaint,
      accent: design.colors.light.focusAccent,
    },
  },
};

export const tamaguiConfig = createTamagui(config);

export default tamaguiConfig;

export type Conf = typeof tamaguiConfig;

declare module "tamagui" {
  interface TamaguiCustomConfig extends Conf {}
}
