import { design } from "@/constants/design";
import { useAppTheme } from "@/context/AppThemeContext";
import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  type StyleProp,
  StyleSheet,
  Text,
  type TextStyle,
  View,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type AppScreenProps = {
  children: React.ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function AppScreen({
  children,
  contentContainerStyle,
  scroll = true,
  style,
}: AppScreenProps) {
  const { colors } = useAppTheme();
  const content = (
    <View style={[styles.screenContent, contentContainerStyle]}>{children}</View>
  );

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={[styles.safeArea, { backgroundColor: colors.background }, style]}
    >
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

export function AppCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useAppTheme();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        style,
      ]}
    >
      {children}
    </View>
  );
}

type PrimaryButtonProps = {
  accessibilityLabel?: string;
  children: React.ReactNode;
  disabled?: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

export function PrimaryButton({
  accessibilityLabel,
  children,
  disabled,
  onPress,
  style,
}: PrimaryButtonProps) {
  const { colors } = useAppTheme();

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        { backgroundColor: pressed ? colors.accentPressed : colors.accent },
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text style={[styles.primaryButtonText, { color: colors.accentText }]}>
        {children}
      </Text>
    </Pressable>
  );
}

export function CircleCheckbox({
  checked,
  label,
  onPress,
}: {
  checked: boolean;
  label: string;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      hitSlop={4}
      onPress={onPress}
      style={styles.checkboxTarget}
    >
      <View
        style={[
          styles.checkbox,
          { borderColor: colors.border },
          checked && { backgroundColor: colors.accent, borderColor: colors.accent },
        ]}
      >
        {checked ? (
          <Ionicons name="checkmark" color={colors.accentText} size={14} />
        ) : null}
      </View>
    </Pressable>
  );
}

export function EstimateChip({
  label,
  onPress,
  selected,
}: {
  label: string;
  onPress: () => void;
  selected?: boolean;
}) {
  const { colors } = useAppTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? colors.accent : colors.surface,
          borderColor: selected ? colors.accent : colors.border,
        },
      ]}
    >
      <Text
        style={[
          styles.chipText,
          { color: selected ? colors.accentText : colors.text },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function SectionLabel({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
}) {
  const { colors } = useAppTheme();

  return (
    <Text style={[styles.sectionLabel, { color: colors.textMuted }, style]}>
      {children}
    </Text>
  );
}

export function StatusMessage({
  children,
  loading,
}: {
  children: React.ReactNode;
  loading?: boolean;
}) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.statusRow}>
      {loading ? <ActivityIndicator color={colors.accent} /> : null}
      <Text style={[styles.statusText, { color: colors.textMuted }]}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  screenContent: {
    alignSelf: "center",
    flexGrow: 1,
    maxWidth: design.contentMaxWidth,
    paddingBottom: design.spacing.xxl,
    paddingHorizontal: design.spacing.lg,
    paddingTop: design.spacing.md,
    width: "100%",
  },
  card: {
    borderRadius: design.radius.md,
    borderWidth: 1,
    padding: design.spacing.md,
  },
  primaryButton: {
    alignItems: "center",
    borderRadius: design.radius.pill,
    justifyContent: "center",
    minHeight: design.touchTarget,
    paddingHorizontal: design.spacing.lg,
  },
  primaryButtonText: {
    fontSize: design.type.body,
    fontWeight: "800",
  },
  disabled: {
    opacity: 0.5,
  },
  checkboxTarget: {
    alignItems: "center",
    height: design.touchTarget,
    justifyContent: "center",
    width: design.touchTarget,
  },
  checkbox: {
    alignItems: "center",
    borderRadius: design.radius.pill,
    borderWidth: 1.5,
    height: 22,
    justifyContent: "center",
    width: 22,
  },
  chip: {
    alignItems: "center",
    borderRadius: design.radius.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: design.touchTarget,
    paddingHorizontal: design.spacing.md,
  },
  chipText: {
    fontSize: design.type.label,
    fontWeight: "800",
  },
  sectionLabel: {
    fontSize: design.type.caption,
    fontWeight: "800",
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },
  statusRow: {
    alignItems: "center",
    gap: design.spacing.sm,
    justifyContent: "center",
    minHeight: 120,
    padding: design.spacing.lg,
  },
  statusText: {
    fontSize: design.type.body,
    lineHeight: 20,
    textAlign: "center",
  },
});
