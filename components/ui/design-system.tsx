import { design } from "@/constants/design";
import { useAppTheme } from "@/context/AppThemeContext";
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
          backgroundColor: selected ? colors.accent : colors.surfaceMuted,
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
    borderRadius: design.radius.lg,
    borderWidth: 1,
    padding: design.spacing.lg,
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
    fontSize: design.type.meta,
    fontWeight: "700",
  },
  sectionLabel: {
    fontSize: design.type.sectionLabel,
    fontWeight: "700",
    letterSpacing: design.letterSpacing.sectionLabel,
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
