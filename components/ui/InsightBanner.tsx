import { design } from "@/constants/design";
import { useAppTheme } from "@/context/AppThemeContext";
import React from "react";
import { StyleSheet, Text, type TextStyle } from "react-native";

type InsightBannerProps = {
  children: React.ReactNode;
  textStyle?: TextStyle;
};

export function InsightBanner({ children, textStyle }: InsightBannerProps) {
  const { colors } = useAppTheme();

  return (
    <Text
      style={[
        styles.banner,
        {
          backgroundColor: colors.accentSoft,
          color: colors.accentSoftText,
        },
        textStyle,
      ]}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderRadius: design.radius.lg,
    fontSize: design.type.meta + 0.5,
    lineHeight: 21,
    overflow: "hidden",
    padding: design.spacing.md,
  },
});
