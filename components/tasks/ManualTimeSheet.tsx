import { BottomSheet } from "@/components/ui/BottomSheet";
import { PillButton } from "@/components/ui/PillButton";
import { design } from "@/constants/design";
import { useAppTheme } from "@/context/AppThemeContext";
import React from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { EstimateChip } from "@/components/ui/design-system";

const QUICK_MINUTES = [5, 20, 30, 60];

type ManualTimeSheetProps = {
  visible: boolean;
  onClose: () => void;
  taskTitle: string;
  minutesInput: string;
  onChangeMinutes: (value: string) => void;
  onSave: () => Promise<unknown>;
  isSaving: boolean;
};

export function ManualTimeSheet({
  visible,
  onClose,
  taskTitle,
  minutesInput,
  onChangeMinutes,
  onSave,
  isSaving,
}: ManualTimeSheetProps) {
  const { colors } = useAppTheme();

  const handleSave = async () => {
    await onSave();
    onClose();
  };

  return (
    <BottomSheet title="Add time manually" visible={visible} onClose={onClose}>
      <Text style={[styles.description, { color: colors.textMuted }]}>
        No timer needed. What should we count for &ldquo;{taskTitle}&rdquo;?
      </Text>

      <View
        style={[
          styles.inputRow,
          { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
        ]}
      >
        <TextInput
          style={[styles.input, { color: colors.text }]}
          keyboardType="numeric"
          placeholder="0"
          placeholderTextColor={colors.textMuted}
          value={minutesInput}
          onChangeText={onChangeMinutes}
        />
        <Text style={[styles.unit, { color: colors.textMuted }]}>minutes</Text>
      </View>

      <View style={styles.chipRow}>
        {QUICK_MINUTES.map((minutes) => (
          <EstimateChip
            key={minutes}
            label={`${minutes}m`}
            selected={minutesInput === String(minutes)}
            onPress={() => onChangeMinutes(String(minutes))}
          />
        ))}
      </View>

      <PillButton
        onPress={handleSave}
        disabled={isSaving || !minutesInput.trim()}
        style={{ marginTop: design.spacing.lg }}
      >
        {isSaving ? "Saving..." : "Save time"}
      </PillButton>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  description: {
    fontSize: design.type.meta + 0.5,
    lineHeight: 20,
    marginBottom: design.spacing.md,
  },
  inputRow: {
    alignItems: "center",
    borderRadius: design.radius.md,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: design.spacing.sm + 2,
    minHeight: 48,
    paddingHorizontal: design.spacing.md,
  },
  input: {
    flex: 1,
    fontSize: design.type.body + 1,
  },
  unit: {
    fontSize: design.type.meta,
  },
  chipRow: {
    flexDirection: "row",
    gap: design.spacing.xs,
  },
});
