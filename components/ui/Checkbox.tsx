import { design } from "@/constants/design";
import { useAppTheme } from "@/context/AppThemeContext";
import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";

type CheckboxProps = {
  checked: boolean;
  label: string;
  onPress: () => void;
  /** Visible circle diameter; tap target is always >=44x44. */
  size?: number;
  /** Use the filled/dark "subtask" style instead of the outlined ring. */
  variant?: "ring" | "fill";
};

export function Checkbox({
  checked,
  label,
  onPress,
  size = 24,
  variant = "ring",
}: CheckboxProps) {
  const { colors } = useAppTheme();
  const hitSlop = Math.max(0, (design.touchTarget - size) / 2);

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      hitSlop={hitSlop}
      onPress={onPress}
      style={{
        alignItems: "center",
        height: Math.max(size, design.touchTarget),
        justifyContent: "center",
        width: Math.max(size, design.touchTarget),
      }}
    >
      <View
        style={[
          styles.circle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: colors.borderStrong,
          },
          checked &&
            variant === "ring" && {
              backgroundColor: colors.accent,
              borderColor: colors.accent,
            },
          checked &&
            variant === "fill" && {
              backgroundColor: colors.text,
              borderColor: colors.text,
            },
        ]}
      >
        {checked ? (
          <Ionicons
            name="checkmark"
            color={variant === "fill" ? colors.background : colors.accentText}
            size={Math.round(size * 0.6)}
          />
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: "center",
    borderWidth: 1.5,
    justifyContent: "center",
  },
});
