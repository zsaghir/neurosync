import { design } from "@/constants/design";
import { useAppTheme } from "@/context/AppThemeContext";
import React from "react";
import { Button, type ButtonProps, Text } from "tamagui";

type PillButtonVariant = "primary" | "secondary" | "text";

type PillButtonProps = Omit<ButtonProps, "variant"> & {
  variant?: PillButtonVariant;
  /** Text color override for the "text" variant, e.g. danger actions. */
  textColor?: string;
};

/**
 * Pill-shaped button matching the design spec: primary (accent fill),
 * secondary (outlined), text (no fill, min 44px tap height). Styled via
 * `style` (RN's universal escape hatch) instead of Tamagui's `$token`
 * shorthand props, whose typed surface on Button is too narrow for this.
 */
export function PillButton({
  variant = "primary",
  textColor,
  children,
  disabled,
  style,
  ...props
}: PillButtonProps) {
  const { colors } = useAppTheme();

  if (variant === "text") {
    return (
      <Button
        chromeless
        disabled={disabled}
        opacity={disabled ? 0.5 : 1}
        pressStyle={{ opacity: 0.6 }}
        style={[
          {
            alignItems: "center",
            justifyContent: "center",
            minHeight: design.touchTarget,
            paddingHorizontal: design.spacing.sm,
          },
          style,
        ]}
        {...props}
      >
        <Text
          fontSize={design.type.body}
          fontWeight="700"
          color={(textColor ?? colors.accent) as never}
        >
          {children}
        </Text>
      </Button>
    );
  }

  if (variant === "secondary") {
    return (
      <Button
        disabled={disabled}
        opacity={disabled ? 0.5 : 1}
        pressStyle={{ opacity: 0.8 }}
        style={[
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: design.radius.pill,
            minHeight: design.touchTarget,
            paddingHorizontal: design.spacing.lg,
          },
          style,
        ]}
        {...props}
      >
        <Text fontSize={design.type.body} fontWeight="700" color={colors.text}>
          {children}
        </Text>
      </Button>
    );
  }

  return (
    <Button
      disabled={disabled}
      opacity={disabled ? 0.5 : 1}
      pressStyle={{ opacity: 0.85 }}
      style={[
        {
          backgroundColor: colors.accent,
          borderWidth: 0,
          borderRadius: design.radius.pill,
          minHeight: 52,
          paddingHorizontal: design.spacing.lg,
        },
        style,
      ]}
      {...props}
    >
      <Text fontSize={16} fontWeight="700" color={colors.accentText}>
        {children}
      </Text>
    </Button>
  );
}
