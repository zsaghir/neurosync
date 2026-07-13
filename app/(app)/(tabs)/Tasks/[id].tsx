import Subtasks from "@/components/subtasks";
import { ManualTimeSheet } from "@/components/tasks/ManualTimeSheet";
import { Checkbox } from "@/components/ui/Checkbox";
import { PillButton } from "@/components/ui/PillButton";
import { SectionLabel } from "@/components/ui/design-system";
import { design } from "@/constants/design";
import { useAppTheme } from "@/context/AppThemeContext";
import { useTaskSession } from "@/hooks/use-task-session";
import {
  fetchTaskSessions,
  type TaskSessionDocument,
} from "@/lib/sanity/taskSessions";
import {
  deleteTask,
  fetchTaskById,
  setTaskNotes,
  toggleTaskComplete,
  type TaskDocument,
  type TaskInput,
} from "@/lib/sanity/tasks";
import { formatDurationLabel } from "@/lib/utils/time-wisdom";
import { useUser } from "@clerk/clerk-expo";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function TaskDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useUser();
  const router = useRouter();
  const { colors } = useAppTheme();

  const [task, setTask] = useState<TaskDocument | null>(null);
  const [sessions, setSessions] = useState<TaskSessionDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const [isManualSheetOpen, setIsManualSheetOpen] = useState(false);

  const load = useCallback(async () => {
    if (!user || !id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const [nextTask, nextSessions] = await Promise.all([
        fetchTaskById(id),
        fetchTaskSessions(user.id),
      ]);
      setTask(nextTask);
      setSessions(nextSessions);
      setNotesDraft(nextTask?.notes ?? "");
    } catch (error) {
      console.error("Error loading task details:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user, id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const session = useTaskSession({
    task: task ?? { _id: id ?? "" },
    userId: user?.id ?? "",
    sessions,
    startedAt: null,
    onTimeCommitted: (_taskId, seconds) => {
      setTask((current) =>
        current
          ? {
              ...current,
              timeSpentSeconds: (current.timeSpentSeconds ?? 0) + Math.round(seconds),
            }
          : current,
      );
    },
  });

  if (isLoading || !task) {
    return (
      <SafeAreaView
        edges={["top", "left", "right"]}
        style={[styles.safeArea, { backgroundColor: colors.background }]}
      >
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Text style={[styles.backText, { color: colors.textMuted }]}>‹ Tasks</Text>
          </Pressable>
        </View>
        <View style={styles.statusBlock}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  const handleToggleComplete = async () => {
    const nextCompleted = !task.completed;
    setTask((current) => (current ? { ...current, completed: nextCompleted } : current));
    try {
      await toggleTaskComplete(task._id, nextCompleted);
    } catch (error) {
      console.error("Error toggling task:", error);
      setTask((current) => (current ? { ...current, completed: task.completed } : current));
    }
  };

  const handleSubtasksChanged = (
    taskId: string,
    subtasks: NonNullable<TaskInput["subtasks"]>,
  ) => {
    setTask((current) => (current && current._id === taskId ? { ...current, subtasks } : current));
  };

  const handleSaveNotes = async () => {
    if (notesDraft === (task.notes ?? "")) return;

    setTask((current) => (current ? { ...current, notes: notesDraft } : current));
    try {
      await setTaskNotes(task._id, notesDraft || null);
    } catch (error) {
      console.error("Error saving notes:", error);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteTask(task._id);
      router.back();
    } catch (error) {
      console.error("Error deleting task:", error);
    }
  };

  const startFocus = () =>
    router.push({
      pathname: "/(app)/focus/[taskId]",
      params: { taskId: task._id },
    } as unknown as Href);

  const openAdjustOrManualTime = () => {
    session.openManualTime();
    setIsManualSheetOpen(true);
  };

  const subtasks = task.subtasks ?? [];
  const completedSubtasks = subtasks.filter((subtask) => subtask.completed).length;

  const metaParts: string[] = [];
  if (task.estimatedMinutes != null) {
    metaParts.push(`Usually takes about ${task.estimatedMinutes} min`);
  }
  if ((task.timeSpentSeconds ?? 0) > 0) {
    metaParts.push(`${formatDurationLabel(task.timeSpentSeconds)} logged`);
  }

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Text style={[styles.backText, { color: colors.textMuted }]}>‹ Tasks</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.titleRow}>
          <Checkbox
            checked={Boolean(task.completed)}
            label={task.completed ? "Mark task incomplete" : "Mark task complete"}
            size={26}
            onPress={() => void handleToggleComplete()}
          />
          <Text
            style={[
              styles.title,
              { color: colors.text },
              task.completed && { color: colors.textFaint, textDecorationLine: "line-through" },
            ]}
          >
            {task.title || "Untitled task"}
          </Text>
        </View>

        {metaParts.length > 0 ? (
          <Text style={[styles.meta, { color: colors.textMuted }]}>
            {metaParts.join(" · ")}
          </Text>
        ) : null}

        {!task.completed ? (
          <PillButton
            accessibilityLabel={`Start focus for ${task.title}`}
            onPress={startFocus}
            style={{ marginTop: design.spacing.md }}
          >
            Start focus
          </PillButton>
        ) : null}

        <SectionLabel style={styles.sectionLabel}>
          Subtasks{subtasks.length > 0 ? ` · ${completedSubtasks} of ${subtasks.length}` : ""}
        </SectionLabel>
        {user ? (
          <Subtasks
            task={task}
            userId={user.id}
            isVisible
            onSubtasksChanged={handleSubtasksChanged}
          />
        ) : null}

        <Pressable
          style={styles.notesDisclosure}
          onPress={() => setIsNotesOpen((open) => !open)}
        >
          <Ionicons
            name={isNotesOpen ? "chevron-down" : "chevron-forward"}
            size={13}
            color={colors.textMuted}
          />
          <Text style={[styles.notesLabel, { color: colors.textMuted }]}>Notes</Text>
        </Pressable>
        {isNotesOpen ? (
          <TextInput
            style={[
              styles.notesInput,
              {
                backgroundColor: colors.surfaceMuted,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
            placeholder="Add a note..."
            placeholderTextColor={colors.textMuted}
            value={notesDraft}
            onChangeText={setNotesDraft}
            onBlur={() => void handleSaveNotes()}
            multiline
          />
        ) : null}

        <View style={styles.secondaryActions}>
          <Pressable onPress={openAdjustOrManualTime} style={styles.secondaryTarget}>
            <Text style={[styles.secondaryText, { color: colors.textMuted }]}>
              Adjust time
            </Text>
          </Pressable>
          <Pressable onPress={openAdjustOrManualTime} style={styles.secondaryTarget}>
            <Text style={[styles.secondaryText, { color: colors.textMuted }]}>
              Add time manually
            </Text>
          </Pressable>
          <Pressable onPress={() => void handleDelete()} style={styles.secondaryTarget}>
            <Text style={[styles.secondaryText, { color: colors.danger }]}>Delete</Text>
          </Pressable>
        </View>
      </ScrollView>

      <ManualTimeSheet
        visible={isManualSheetOpen}
        onClose={() => {
          setIsManualSheetOpen(false);
          session.clearReview();
        }}
        taskTitle={task.title ?? "this task"}
        minutesInput={session.actualMinutesInput}
        onChangeMinutes={session.setActualMinutesInput}
        onSave={session.saveReviewedTime}
        isSaving={session.isSaving}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    height: 44,
    justifyContent: "center",
    paddingHorizontal: design.spacing.lg,
  },
  backButton: {
    alignSelf: "flex-start",
    justifyContent: "center",
    minHeight: design.touchTarget,
  },
  backText: {
    fontSize: design.type.cardTitle - 1,
  },
  statusBlock: {
    alignItems: "center",
    paddingTop: design.spacing.xxl,
  },
  content: {
    paddingBottom: design.spacing.huge,
    paddingHorizontal: design.spacing.lg,
  },
  titleRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: design.spacing.sm + 2,
  },
  title: {
    flex: 1,
    fontSize: design.type.cardTitle + 2,
    fontWeight: "700",
    lineHeight: 28,
    paddingTop: 2,
  },
  meta: {
    fontSize: design.type.meta + 0.5,
    marginLeft: 38,
    marginTop: design.spacing.xs,
  },
  sectionLabel: {
    marginBottom: design.spacing.xs,
    marginLeft: 38,
    marginTop: design.spacing.xl,
  },
  notesDisclosure: {
    alignItems: "center",
    flexDirection: "row",
    gap: design.spacing.xxs,
    marginLeft: 38,
    marginTop: design.spacing.md,
    minHeight: design.touchTarget - 8,
  },
  notesLabel: {
    fontSize: design.type.meta + 0.5,
    fontWeight: "700",
  },
  notesInput: {
    borderRadius: design.radius.md,
    borderWidth: 1,
    fontSize: design.type.body,
    marginLeft: 38,
    marginTop: design.spacing.xs,
    minHeight: 80,
    padding: design.spacing.sm,
    textAlignVertical: "top",
  },
  secondaryActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: design.spacing.lg,
    marginLeft: 38,
    marginTop: design.spacing.xl,
  },
  secondaryTarget: {
    justifyContent: "center",
    minHeight: design.touchTarget,
  },
  secondaryText: {
    fontSize: design.type.meta,
  },
});
