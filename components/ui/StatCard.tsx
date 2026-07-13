import { design } from "@/constants/design";
import { useAppTheme } from "@/context/AppThemeContext";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

type StatCardProps = {
  value: string;
  label: string;
};

export function StatCard({ value, label }: StatCardProps) {
  const { colors } = useAppTheme();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <Text style={[styles.value, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: design.radius.lg,
    borderWidth: 1,
    flex: 1,
    padding: design.spacing.md,
  },
  value: {
    fontSize: design.type.cardTitle + 4,
    fontWeight: "800",
  },
  label: {
    fontSize: design.type.caption,
    marginTop: 2,
  },
});
