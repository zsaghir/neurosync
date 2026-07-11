import {
  setTaskSubtasks,
  toggleSubtaskComplete,
  type TaskDocument,
  type TaskInput,
} from "@/lib/sanity/tasks";
import Ionicons from "@expo/vector-icons/Ionicons";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Subtask = NonNullable<TaskInput["subtasks"]>[number];

type GenerateSubtasksResponse = {
  subtasks?: NonNullable<TaskInput["subtasks"]>;
  error?: string;
};

type SubtaskTheme = {
  line: string;
  text: string;
  subtle: string;
  background: string;
};

type SubtasksProps = {
  task: TaskDocument;
  userId: string;
  isVisible: boolean;
  theme: SubtaskTheme;
  onSubtasksChanged: (
    taskId: string,
    subtasks: NonNullable<TaskInput["subtasks"]>,
  ) => void;
};

const Subtasks = ({
  task,
  userId,
  isVisible,
  theme,
  onSubtasksChanged,
}: SubtasksProps) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [updatingSubtaskKey, setUpdatingSubtaskKey] = useState<string | null>(
    null,
  );
  const [error, setError] = useState("");
  const subtasks = task.subtasks ?? [];
  const hasSubtasks = subtasks.length > 0;

  const handleGenerateSubtasks = async () => {
    setError("");
    setIsGenerating(true);

    try {
      const response = await fetch("/api/subtasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ taskId: task._id, userId }),
      });
      const body = (await response.json()) as GenerateSubtasksResponse;

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to generate subtasks.");
      }

      if (!body.subtasks) {
        throw new Error("The subtasks API did not return any subtasks.");
      }

      const savedTask = await setTaskSubtasks(task._id, body.subtasks);
      onSubtasksChanged(task._id, savedTask.subtasks ?? body.subtasks);
    } catch (generateError) {
      console.error("Error generating subtasks:", generateError);
      setError("Could not generate subtasks. Please try again.");
    } finally {
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

  if (!isVisible) return null;

  return (
    <View style={[styles.container, { borderColor: theme.line }]}>
      {hasSubtasks ? (
        subtasks.map((subtask) => (
          <Pressable
            key={subtask._key ?? subtask.title}
            style={[styles.subtaskRow, { borderColor: theme.line }]}
            disabled={updatingSubtaskKey === subtask._key}
            onPress={() => handleToggleSubtask(subtask)}
          >
            <View
              style={[
                styles.checkbox,
                { borderColor: theme.subtle },
                subtask.completed && { backgroundColor: theme.text },
              ]}
            >
              {subtask.completed ? (
                <Ionicons name="checkmark" size={14} color={theme.background} />
              ) : null}
            </View>
            <Text
              style={[
                styles.subtaskText,
                { color: theme.text },
                subtask.completed && styles.completedSubtaskText,
              ]}
            >
              {subtask.title}
            </Text>
          </Pressable>
        ))
      ) : (
        <Pressable
          style={styles.generateInlineButton}
          disabled={isGenerating}
          onPress={handleGenerateSubtasks}
        >
          <Ionicons name="sparkles-outline" size={16} color={theme.subtle} />
          <Text style={[styles.generateInlineText, { color: theme.subtle }]}>
            {isGenerating ? "Generating..." : "Generate subtasks"}
          </Text>
        </Pressable>
      )}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
};

export default Subtasks;

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    marginLeft: 54,
    marginTop: 10,
  },
  subtaskRow: {
    alignItems: "center",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 44,
  },
  checkbox: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    height: 26,
    justifyContent: "center",
    width: 26,
  },
  subtaskText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
  },
  completedSubtaskText: {
    textDecorationLine: "line-through",
  },
  generateInlineButton: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    minHeight: 42,
  },
  generateInlineText: {
    fontSize: 14,
    fontWeight: "800",
  },
  errorText: {
    color: "#ff7b7b",
    fontSize: 13,
    marginTop: 8,
  },
});
