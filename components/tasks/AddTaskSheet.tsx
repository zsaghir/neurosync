import { BottomSheet } from "@/components/ui/BottomSheet";
import { EstimateChip } from "@/components/ui/design-system";
import { PillButton } from "@/components/ui/PillButton";
import { design } from "@/constants/design";
import { useAppTheme } from "@/context/AppThemeContext";
import { createTask, type TaskDocument } from "@/lib/sanity/tasks";
import {
  DEFAULT_USER_TIME_SETTINGS,
  getEstimateChoicesForMode,
  getTimeEstimationModeLabel,
  type EstimateInputType,
  type UserTimeSettings,
} from "@/lib/utils/time-wisdom";
import Ionicons from "@expo/vector-icons/Ionicons";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

type AddTaskSheetProps = {
  visible: boolean;
  onClose: () => void;
  userId: string;
  timeSettings: UserTimeSettings | null;
  onCreated: (task: TaskDocument) => void;
};

export function AddTaskSheet({
  visible,
  onClose,
  userId,
  timeSettings,
  onCreated,
}: AddTaskSheetProps) {
  const { colors } = useAppTheme();
  const activeSettings = timeSettings ?? DEFAULT_USER_TIME_SETTINGS;
  const estimateChoices = getEstimateChoicesForMode(
    activeSettings.preferredTimeEstimationMode,
  );

  const [title, setTitle] = useState("");
  const [titleError, setTitleError] = useState("");
  const [isEstimateOpen, setIsEstimateOpen] = useState(false);
  const [selectedEstimateMinutes, setSelectedEstimateMinutes] = useState<
    number | null
  >(null);
  const [selectedEstimateType, setSelectedEstimateType] =
    useState<EstimateInputType>("skipped");
  const [customEstimate, setCustomEstimate] = useState("");
  const [isAddingTask, setIsAddingTask] = useState(false);

  const resetForm = () => {
    setTitle("");
    setTitleError("");
    setIsEstimateOpen(false);
    setSelectedEstimateMinutes(null);
    setSelectedEstimateType("skipped");
    setCustomEstimate("");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleEstimateChoice = (
    minutes: number | null,
    inputType: EstimateInputType,
  ) => {
    setSelectedEstimateMinutes(minutes);
    setSelectedEstimateType(inputType);
  };

  const getTaskEstimateMinutes = () => {
    if (activeSettings.preferredTimeEstimationMode !== "custom") {
      return selectedEstimateMinutes;
    }

    if (selectedEstimateType === "skipped") return null;

    const parsedEstimate = Number(customEstimate);
    return Number.isFinite(parsedEstimate) && parsedEstimate > 0
      ? Math.round(parsedEstimate)
      : null;
  };

  const handleAddTask = async () => {
    if (isAddingTask) return;

    if (!title.trim()) {
      setTitleError("Please enter a task title.");
      return;
    }

    setIsAddingTask(true);
    setTitleError("");

    try {
      const createdTask = await createTask({
        title: title.trim(),
        userId,
        estimatedMinutes: getTaskEstimateMinutes(),
      });

      onCreated(createdTask);
      resetForm();
      onClose();
    } catch (error) {
      console.error("Error adding task:", error);
      setTitleError("Could not add this task. Please try again.");
    } finally {
      setIsAddingTask(false);
    }
  };

  return (
    <BottomSheet title="New task" visible={visible} onClose={handleClose}>
      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: colors.surfaceMuted,
            borderColor: colors.border,
            color: colors.text,
          },
        ]}
        placeholder="What needs doing?"
        placeholderTextColor={colors.textMuted}
        value={title}
        onChangeText={(text) => {
          setTitle(text);
          if (titleError) setTitleError("");
        }}
        autoFocus
      />
      {titleError ? (
        <Text style={[styles.errorText, { color: colors.danger }]}>
          {titleError}
        </Text>
      ) : null}

      <Pressable
        style={styles.disclosureRow}
        onPress={() => setIsEstimateOpen((open) => !open)}
      >
        <Ionicons
          name={isEstimateOpen ? "chevron-down" : "chevron-forward"}
          size={14}
          color={colors.accent}
        />
        <Text style={[styles.disclosureText, { color: colors.accent }]}>
          Add estimate
        </Text>
      </Pressable>

      {isEstimateOpen ? (
        <View style={styles.estimateBlock}>
          {activeSettings.preferredTimeEstimationMode === "custom" ? (
            <View style={styles.customEstimateRow}>
              <TextInput
                style={[
                  styles.customEstimateInput,
                  {
                    backgroundColor: colors.surfaceMuted,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                placeholder="Minutes"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                value={customEstimate}
                onChangeText={(value) => {
                  setCustomEstimate(value);
                  setSelectedEstimateType("custom");
                }}
              />
              <EstimateChip
                label="Skip"
                selected={selectedEstimateType === "skipped"}
                onPress={() => {
                  setSelectedEstimateMinutes(null);
                  setSelectedEstimateType("skipped");
                  setCustomEstimate("");
                }}
              />
            </View>
          ) : (
            <View style={styles.estimateChoices}>
              {estimateChoices.map((choice) => (
                <EstimateChip
                  key={`${choice.label}-${choice.inputType}`}
                  label={
                    choice.minutes != null
                      ? `${choice.label} · ${choice.minutes}m`
                      : choice.label
                  }
                  selected={
                    selectedEstimateMinutes === choice.minutes &&
                    selectedEstimateType === choice.inputType
                  }
                  onPress={() =>
                    handleEstimateChoice(choice.minutes, choice.inputType)
                  }
                />
              ))}
            </View>
          )}
          <Text style={[styles.settingHint, { color: colors.textMuted }]}>
            {getTimeEstimationModeLabel(activeSettings.preferredTimeEstimationMode)}
          </Text>
        </View>
      ) : null}

      <PillButton
        onPress={handleAddTask}
        disabled={isAddingTask}
        style={{ marginTop: design.spacing.md }}
      >
        {isAddingTask ? "Adding..." : "Add task"}
      </PillButton>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  input: {
    borderRadius: design.radius.md,
    borderWidth: 1,
    fontSize: design.type.body + 1,
    minHeight: 48,
    paddingHorizontal: design.spacing.md,
  },
  errorText: {
    fontSize: design.type.meta,
    fontWeight: "700",
    marginTop: design.spacing.xs,
  },
  disclosureRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: design.spacing.xxs,
    marginTop: design.spacing.md,
    minHeight: design.touchTarget - 8,
  },
  disclosureText: {
    fontSize: design.type.meta,
    fontWeight: "700",
  },
  estimateBlock: {
    gap: design.spacing.sm,
  },
  estimateChoices: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: design.spacing.xs,
  },
  customEstimateRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: design.spacing.xs,
  },
  customEstimateInput: {
    borderRadius: design.radius.md,
    borderWidth: 1,
    flex: 1,
    fontSize: design.type.body,
    minHeight: design.touchTarget,
    minWidth: 140,
    paddingHorizontal: design.spacing.sm + 2,
  },
  settingHint: {
    fontSize: design.type.caption,
  },
});
