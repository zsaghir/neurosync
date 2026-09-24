import { design } from "@/constants/design";
import { useActiveTimer } from "@/context/ActiveTimerContext";
import { useAppTheme } from "@/context/AppThemeContext";
import type { TaskDocument } from "@/lib/api/tasks";
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

/**
 * Mirrors the focus screen's clock. It computes elapsed time from the same
 * startedAt/accumulatedSeconds the focus screen publishes; the interval only
 * repaints this label, so the rest of the row does not re-render every second.
 */
function FocusingLabel({ startedAt, accumulatedSeconds }: { startedAt: number; accumulatedSeconds: number }) {
  const { colors } = useAppTheme();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const elapsed = accumulatedSeconds + Math.max(0, now - startedAt) / 1000;

  return (
    <Text style={[styles.meta, styles.focusingMeta, { color: colors.accent }]}>
      ● Focusing · {formattime(elapsed)}
    </Text>
  );
}

export function TaskRow({ task, onToggleComplete, onPress }: TaskRowProps) {
  const { colors } = useAppTheme();
  const { activeTimer } = useActiveTimer();

  const focusingTimer = activeTimer?.taskId === task._id ? activeTimer : null;
  const isFocusing = focusingTimer != null;
  const meta = buildMeta(task);

  return (
    <View
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
      <Pressable
        accessibilityRole={onPress ? "button" : undefined}
        accessibilityLabel={onPress ? `Open task: ${task.title || "Untitled task"}` : undefined}
        onPress={onPress}
        disabled={!onPress}
        style={styles.textColumn}
      >
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
        {focusingTimer ? (
          <FocusingLabel
            startedAt={focusingTimer.startedAt}
            accumulatedSeconds={focusingTimer.accumulatedSeconds}
          />
        ) : meta ? (
          <Text style={[styles.meta, { color: colors.textMuted }]}>{meta}</Text>
        ) : null}
      </Pressable>
    </View>
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
    minHeight: design.touchTarget,
    justifyContent: "center",
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
