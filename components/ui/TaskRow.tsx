import { design } from "@/constants/design";
import { useActiveTimer } from "@/context/ActiveTimerContext";
import { useAppTheme } from "@/context/AppThemeContext";
import type { TaskDocument } from "@/lib/sanity/tasks";
import formattime from "@/lib/utils/formattime";
import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Checkbox } from "./Checkbox";

type TaskRowProps = {
  task: TaskDocument;
  onToggleComplete: () => void;
  onPress?: () => void;
};

function buildMeta(task: TaskDocument) {
  const parts: string[] = [];

  if (task.estimatedMinutes) {
    parts.push(`${task.estimatedMinutes} min`);
  }

  const subtasks = task.subtasks ?? [];
  if (subtasks.length > 0) {
    const done = subtasks.filter((subtask) => subtask.completed).length;
    parts.push(`${done} of ${subtasks.length} subtasks`);
  }

  return parts.join(" · ");
}

export function TaskRow({ task, onToggleComplete, onPress }: TaskRowProps) {
  const { colors } = useAppTheme();
  const { activeTimer } = useActiveTimer();
  const [, setTick] = useState(0);

  const isFocusing = activeTimer?.taskId === task._id;

  useEffect(() => {
    if (!isFocusing) return;

    const interval = setInterval(() => setTick((value) => value + 1), 1000);
    return () => clearInterval(interval);
  }, [isFocusing]);

  const meta = buildMeta(task);
  const liveElapsed = isFocusing
    ? activeTimer!.accumulatedSeconds + (Date.now() - activeTimer!.startedAt) / 1000
    : 0;

  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      onPress={onPress}
      style={[
        styles.row,
        { borderTopColor: colors.border },
        isFocusing && [styles.focusingRow, { backgroundColor: colors.accentSoft }],
      ]}
    >
      <Checkbox
        checked={Boolean(task.completed)}
        label={task.completed ? "Mark task incomplete" : "Mark task complete"}
        onPress={onToggleComplete}
      />
      <View style={styles.textColumn}>
        <Text
          numberOfLines={2}
          style={[
            styles.title,
            { color: colors.text },
            task.completed && { color: colors.textFaint, textDecorationLine: "line-through" },
          ]}
        >
          {task.title || "Untitled task"}
        </Text>
        {isFocusing ? (
          <Text style={[styles.meta, styles.focusingMeta, { color: colors.accent }]}>
            ● Focusing · {formattime(liveElapsed)}
          </Text>
        ) : meta ? (
          <Text style={[styles.meta, { color: colors.textMuted }]}>{meta}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: design.spacing.sm,
    minHeight: design.touchTarget,
    paddingVertical: design.spacing.sm + 3,
  },
  focusingRow: {
    borderRadius: design.radius.md,
    borderTopWidth: 0,
    marginVertical: 2,
    paddingHorizontal: design.spacing.sm,
  },
  textColumn: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: design.type.taskRowTitle,
    fontWeight: "600",
    lineHeight: 22,
  },
  meta: {
    fontSize: design.type.meta,
    marginTop: 2,
  },
  focusingMeta: {
    fontWeight: "700",
  },
});
