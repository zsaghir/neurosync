import { ManualTimeSheet } from "@/components/tasks/ManualTimeSheet";
import { Checkbox } from "@/components/ui/Checkbox";
import { PillButton } from "@/components/ui/PillButton";
import { SectionLabel } from "@/components/ui/design-system";
import { design } from "@/constants/design";
import { useAppTheme } from "@/context/AppThemeContext";
import {
  useDeleteTask,
  useSaveTaskNotes,
  useTask,
  useTaskSessions,
  useToggleTaskComplete,
} from "@/hooks/queries/tasks";
import { useQueryScope } from "@/hooks/queries/use-query-scope";
import { useRefreshOnFocus } from "@/hooks/use-refresh-on-focus";
import { useSingleNavigation } from "@/hooks/use-single-navigation";
import { useTaskSession } from "@/hooks/use-task-session";
import { APIRequestError, taskErrorMessage } from "@/lib/api/client";
import { queryKeys } from "@/lib/query/keys";
import { formatDurationLabel } from "@/lib/utils/time-wisdom";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
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
  const { isAuthLoaded, isSignedIn, userId } = useQueryScope();
  const router = useRouter();
  const navigate = useSingleNavigation();
  const { colors } = useAppTheme();

  const taskQuery = useTask(id);
  const sessionsQuery = useTaskSessions();
  useRefreshOnFocus(userId && id ? queryKeys.task(userId, id) : null);
  useRefreshOnFocus(userId ? queryKeys.taskSessions(userId) : null);

  const completion = useToggleTaskComplete();
  const notesMutation = useSaveTaskNotes();
  const deletion = useDeleteTask();

  const task = taskQuery.data ?? null;
  const sessions = sessionsQuery.data ?? [];
  const isMissing = taskQuery.error instanceof APIRequestError && taskQuery.error.status === 404;
  const actionError = completion.error
    ? taskErrorMessage(completion.error, "Couldn't save completion. Please retry.")
    : notesMutation.error
      ? taskErrorMessage(notesMutation.error, "Couldn't save your notes. Your draft is still here; use Save notes to retry.")
      : deletion.error
        ? taskErrorMessage(deletion.error, "Couldn't delete this task. Please retry.")
        : "";
  const loadError = isMissing
    ? "This task is no longer available."
    : taskQuery.error
      ? taskErrorMessage(taskQuery.error, "Couldn't load your tasks. Check your connection and retry.")
      : "";
  const error = actionError || loadError;

  const notesDirty = useRef(false);
  const draftRef = useRef("");
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const [isManualSheetOpen, setIsManualSheetOpen] = useState(false);

  useEffect(() => {
    notesDirty.current = false;
    draftRef.current = "";
    setNotesDraft("");
    setIsNotesOpen(false);
    setIsManualSheetOpen(false);
  }, [userId, id]);
  useEffect(() => {
    if (!notesDirty.current) {
      draftRef.current = task?.notes ?? "";
      setNotesDraft(draftRef.current);
    }
  }, [task?.notes, userId, id]);

  const session = useTaskSession({
    task: task ?? { _id: id ?? "" },
    sessions,
    startedAt: null,
  });

  const retryLoad = () => {
    completion.reset();
    notesMutation.reset();
    deletion.reset();
    void taskQuery.refetch();
  };

  if (!task) {
    // Spinner only for a task we have never loaded; never for a refresh.
    const isFirstLoad = userId != null && taskQuery.isPending;
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
          {!isAuthLoaded || isFirstLoad ? <ActivityIndicator color={colors.accent} /> : (
            <>
              <Text accessibilityRole="alert" style={{ color: colors.text }}>
                {loadError || (!isSignedIn ? "Please sign in to view this task." : "This task is no longer available.")}
              </Text>
              {isSignedIn && !isMissing && (
                <Pressable accessibilityRole="button" onPress={retryLoad}>
                  <Text style={{ color: colors.accent }}>Retry</Text>
                </Pressable>
              )}
            </>
          )}
        </View>
      </SafeAreaView>
    );
  }

  const handleSaveNotes = async () => {
    if (notesDraft === (task.notes ?? "") || notesMutation.isPending) return;
    const savedDraft = notesDraft;
    try {
      await notesMutation.mutateAsync({ taskId: task._id, notes: savedDraft || null });
      notesDirty.current = draftRef.current !== savedDraft;
    } catch {
      // The error is shown from notesMutation.error; the draft is kept.
    }
  };

  const handleDelete = async () => {
    if (deletion.isPending) return;
    try {
      await deletion.mutateAsync(task._id);
      router.back();
    } catch {
      // The error is shown from deletion.error.
    }
  };

  const startFocus = () =>
    navigate({
      pathname: "/(app)/focus/[taskId]",
      params: { taskId: task._id },
    } as unknown as Href);

  const openCheckIn = () =>
    navigate({
      pathname: "/(app)/check-in",
      params: { taskId: task._id, taskTitle: task.title },
    } as unknown as Href);

  const openAdjustOrManualTime = () => {
    session.openManualTime();
    setIsManualSheetOpen(true);
  };

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
        {!!error && (
          <View>
            <Text accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Text>
            <Pressable accessibilityRole="button" onPress={retryLoad}>
              <Text style={{ color: colors.accent }}>Retry loading</Text>
            </Pressable>
          </View>
        )}
        <View style={styles.titleRow}>
          <Checkbox
            checked={Boolean(task.completed)}
            label={task.completed ? "Mark task incomplete" : "Mark task complete"}
            size={26}
            onPress={() => completion.toggle(task)}
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
          <View style={styles.primaryActions}>
            <PillButton
              accessibilityLabel={`Start focus for ${task.title}`}
              onPress={startFocus}
              style={styles.growButton}
            >
              Start focus
            </PillButton>
            <PillButton variant="secondary" onPress={openCheckIn} style={styles.growButton}>
              I’m stuck
            </PillButton>
          </View>
        ) : null}

        <SectionLabel style={styles.sectionLabel}>Subtasks</SectionLabel>
        <Text style={[styles.meta, { color: colors.textMuted }]}>Subtasks are temporarily unavailable.</Text>

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
            onChangeText={value => {
              notesDirty.current = true;
              draftRef.current = value;
              setNotesDraft(value);
            }}
            onBlur={() => void handleSaveNotes()}
            multiline
          />
        ) : null}

        {isNotesOpen && notesDirty.current && (
          <Pressable accessibilityRole="button" onPress={() => void handleSaveNotes()} style={styles.secondaryTarget}>
            <Text style={[styles.secondaryText, { color: colors.accent }]}>Save notes</Text>
          </Pressable>
        )}

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
  primaryActions: {
    flexDirection: "row",
    gap: design.spacing.sm,
    marginLeft: 38,
    marginTop: design.spacing.md,
  },
  growButton: {
    flex: 1,
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
