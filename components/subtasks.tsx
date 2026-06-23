import {
  setTaskSubtasks,
  toggleSubtaskComplete,
  type TaskDocument,
  type TaskInput,
} from "@/lib/sanity/tasks";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Subtask = NonNullable<TaskInput["subtasks"]>[number];

type GenerateSubtasksResponse = {
  subtasks?: NonNullable<TaskInput["subtasks"]>;
  error?: string;
};

type SubtasksProps = {
  task: TaskDocument;
  userId: string;
  isVisible: boolean;
  onToggleVisible: (taskId: string) => void;
  onSubtasksChanged: (
    taskId: string,
    subtasks: NonNullable<TaskInput["subtasks"]>,
  ) => void;
};

const Subtasks = ({
  task,
  userId,
  isVisible,
  onToggleVisible,
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

      if (!isVisible) {
        onToggleVisible(task._id);
      }
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

  return (
    <View style={styles.container}>
      <View style={styles.actionsRow}>
        <Pressable
          style={styles.outlineButton}
          onPress={() => onToggleVisible(task._id)}
        >
          <Text style={styles.outlineButtonText}>
            {isVisible ? "Hide subtasks" : "View subtasks"}
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.generateButton,
            isGenerating && styles.disabledButton,
          ]}
          disabled={isGenerating}
          onPress={handleGenerateSubtasks}
        >
          <Text style={styles.generateButtonText}>
            {isGenerating
              ? "Generating..."
              : hasSubtasks
                ? "Regenerate"
                : "Generate"}
          </Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {isVisible ? (
        <View style={styles.subtasksContainer}>
          {hasSubtasks ? (
            subtasks.map((subtask) => (
              <Pressable
                key={subtask._key ?? subtask.title}
                style={styles.subtaskRow}
                disabled={updatingSubtaskKey === subtask._key}
                onPress={() => handleToggleSubtask(subtask)}
              >
                <View
                  style={[
                    styles.checkbox,
                    subtask.completed && styles.checkedBox,
                  ]}
                >
                  {subtask.completed ? (
                    <Text style={styles.checkmark}>X</Text>
                  ) : null}
                </View>
                <Text
                  style={[
                    styles.subtaskText,
                    subtask.completed && styles.completedSubtaskText,
                  ]}
                >
                  {subtask.title}
                </Text>
              </Pressable>
            ))
          ) : (
            <Text style={styles.emptyText}>No subtasks yet.</Text>
          )}
        </View>
      ) : null}
    </View>
  );
};

export default Subtasks;

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
  },
  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  outlineButton: {
    alignItems: "center",
    borderColor: "#7f272d",
    borderRadius: 7,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: 12,
  },
  outlineButtonText: {
    color: "#ffb3b8",
    fontSize: 14,
    fontWeight: "700",
  },
  generateButton: {
    alignItems: "center",
    backgroundColor: "#b3262f",
    borderRadius: 7,
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: 12,
  },
  disabledButton: {
    opacity: 0.6,
  },
  generateButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  errorText: {
    color: "#ff7b7b",
    fontSize: 13,
    marginTop: 10,
  },
  subtasksContainer: {
    borderTopColor: "#333333",
    borderTopWidth: 1,
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
  },
  subtaskRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    minHeight: 32,
  },
  checkbox: {
    alignItems: "center",
    borderColor: "#b3262f",
    borderRadius: 5,
    borderWidth: 1,
    height: 22,
    justifyContent: "center",
    width: 22,
  },
  checkedBox: {
    backgroundColor: "#b3262f",
  },
  checkmark: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
  subtaskText: {
    color: "#f4f4f4",
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  completedSubtaskText: {
    color: "#9d9d9d",
    textDecorationLine: "line-through",
  },
  emptyText: {
    color: "#8f8f8f",
    fontSize: 14,
  },
});
