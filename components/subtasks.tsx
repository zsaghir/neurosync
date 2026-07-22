import { Checkbox } from "@/components/ui/Checkbox";
import { design } from "@/constants/design";
import { useAppTheme } from "@/context/AppThemeContext";
import {
  addSubtask,
  toggleSubtaskComplete,
  type TaskDocument,
  type TaskInput
} from "@/lib/sanity/tasks";
import Ionicons from "@expo/vector-icons/Ionicons";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

type Subtask = NonNullable<TaskInput["subtasks"]>[number];

type GenerateSubtasksResponse = {
  subtasks?: NonNullable<TaskInput["subtasks"]>;
  error?: {
    code: string;
    message: string;
  };
};

type SubtasksProps = {
  task: TaskDocument;
  userId: string;
  isVisible: boolean;
  onSubtasksChanged: (
    taskId: string,
    subtasks: NonNullable<TaskInput["subtasks"]>,
  ) => void;
};

const Subtasks = ({
  task,
  userId,
  isVisible,
  onSubtasksChanged,
}: SubtasksProps) => {
  const { colors } = useAppTheme();
  const [isGenerating, setIsGenerating] = useState(false);
  const [updatingSubtaskKey, setUpdatingSubtaskKey] = useState<string | null>(
    null,
  );
  const [isAddingRow, setIsAddingRow] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [error, setError] = useState("");
  const subtasks = task.subtasks ?? [];
  const hasSubtasks = subtasks.length > 0;

  const handleGenerateSubtasks = async () => {
    try {
      setIsGenerating(true)
      setError("")
      const apiUrl = process.env.EXPO_PUBLIC_API_URL
      if(!apiUrl) {
        throw new Error("Missing API URL")
      }
      const taskTitle = task.title?.trim()
      if (!taskTitle) {
        throw new Error("This task needs a title before generating subtasks.");
      }
      const response = await fetch(`${apiUrl}/subtasks`,{
        method : "POST",
        headers: {"Content-type": "application/json"},
        body: JSON.stringify({taskTitle})
      })
      const body = (await response.json() as GenerateSubtasksResponse)
      if (!response.ok) {
        throw new Error("failed to generate subtasks")
      }
      if (!response.body) {
        throw new Error("Server didnot return subtasks")
      }
      if (!Array.isArray(body.subtasks)) {
        throw new Error("The server returned an invalid subtask response.");
      }
      onSubtasksChanged(task._id, body.subtasks);
    }
    catch (error){
      const message =
    error instanceof Error
      ? error.message
      : "Something went wrong.";

  console.error("Error generating subtasks:", error);
  setError(message);
    }
    finally {
      setIsGenerating(false);
    }
  };

  const handleToggleSubtask = async (subtask: Subtask) => {
    if (!subtask._key) return;

    const nextCompleted = !subtask.completed;
    const nextSubtasks = subtasks.map((currentSubtask) =>
      currentSubtask._key === subtask._key
        ? { ...currentSubtask, completed: nextCompleted }
        : currentSubtask,
    );

    setError("");
    setUpdatingSubtaskKey(subtask._key);
    onSubtasksChanged(task._id, nextSubtasks);

    try {
      await toggleSubtaskComplete(task._id, nextCompleted, subtask._key);
    } catch (toggleError) {
      console.error("Error toggling subtask:", toggleError);
      onSubtasksChanged(task._id, subtasks);
      setError("Could not update the subtask. Please try again.");
    } finally {
      setUpdatingSubtaskKey(null);
    }
  };

  const handleAddSubtask = async () => {
    const title = draftTitle.trim();
    if (!title || isSavingDraft) return;

    setError("");
    setIsSavingDraft(true);

    try {
      const savedTask = await addSubtask(task._id, title);
      onSubtasksChanged(
        task._id,
        savedTask.subtasks ?? [...subtasks, { title, completed: false }],
      );
      setDraftTitle("");
      setIsAddingRow(false);
    } catch (addError) {
      console.error("Error adding subtask:", addError);
      setError("Could not add the subtask. Please try again.");
    } finally {
      setIsSavingDraft(false);
    }
  };

  if (!isVisible) return null;

  return (
    <View style={styles.container}>
      {hasSubtasks
        ? subtasks.map((subtask) => (
            <Pressable
              key={subtask._key ?? subtask.title}
              style={[styles.subtaskRow, { borderTopColor: colors.border }]}
              disabled={updatingSubtaskKey === subtask._key}
              onPress={() => handleToggleSubtask(subtask)}
            >
              <Checkbox
                checked={Boolean(subtask.completed)}
                label={subtask.title}
                size={18}
                variant="fill"
                onPress={() => handleToggleSubtask(subtask)}
              />
              <Text
                style={[
                  styles.subtaskText,
                  { color: colors.text },
                  subtask.completed && {
                    color: colors.textFaint,
                    textDecorationLine: "line-through",
                  },
                ]}
              >
                {subtask.title}
              </Text>
            </Pressable>
          ))
        : !isAddingRow && (
            <Pressable
              style={styles.generateInlineButton}
              disabled={isGenerating}
              onPress={handleGenerateSubtasks}
            >
              <Ionicons name="sparkles-outline" size={16} color={colors.textMuted} />
              <Text style={[styles.generateInlineText, { color: colors.textMuted }]}>
                {isGenerating ? "Generating..." : "Generate subtasks"}
              </Text>
            </Pressable>
          )}

      {isAddingRow ? (
        <View style={[styles.addRow, { borderTopColor: colors.border }]}>
          <TextInput
            autoFocus
            style={[styles.addInput, { color: colors.text }]}
            placeholder="New subtask"
            placeholderTextColor={colors.textMuted}
            value={draftTitle}
            onChangeText={setDraftTitle}
            onSubmitEditing={handleAddSubtask}
            returnKeyType="done"
          />
          <Pressable
            onPress={handleAddSubtask}
            disabled={isSavingDraft || !draftTitle.trim()}
            style={styles.addSubtaskTarget}
          >
            <Text
              style={[
                styles.addSubtaskText,
                { color: colors.accent },
                (isSavingDraft || !draftTitle.trim()) && { opacity: 0.5 },
              ]}
            >
              Add
            </Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          style={styles.addSubtaskTarget}
          onPress={() => setIsAddingRow(true)}
        >
          <Text style={[styles.addSubtaskText, { color: colors.accent }]}>
            + Add subtask
          </Text>
        </Pressable>
      )}

      {error ? (
        <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
      ) : null}
    </View>
  );
};

export default Subtasks;

const styles = StyleSheet.create({
  container: {
    marginTop: design.spacing.xs,
  },
  subtaskRow: {
    alignItems: "center",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: design.spacing.sm,
    minHeight: design.touchTarget,
  },
  subtaskText: {
    flex: 1,
    fontSize: design.type.body - 0.5,
    lineHeight: 20,
  },
  generateInlineButton: {
    alignItems: "center",
    flexDirection: "row",
    gap: design.spacing.xs,
    minHeight: design.touchTarget,
  },
  generateInlineText: {
    fontSize: design.type.meta,
    fontWeight: "700",
  },
  addRow: {
    alignItems: "center",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: design.spacing.sm,
    minHeight: design.touchTarget,
  },
  addInput: {
    flex: 1,
    fontSize: design.type.body - 0.5,
  },
  addSubtaskTarget: {
    justifyContent: "center",
    minHeight: design.touchTarget,
    paddingVertical: design.spacing.xs,
  },
  addSubtaskText: {
    fontSize: design.type.meta,
    fontWeight: "700",
  },
  errorText: {
    fontSize: design.type.meta,
    marginTop: design.spacing.xs,
  },
});
