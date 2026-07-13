import {
  AppCard,
  AppScreen,
  CircleCheckbox,
  PrimaryButton,
  SectionLabel,
  StatusMessage,
} from "@/components/ui/design-system";
import { design } from "@/constants/design";
import { useAppTheme } from "@/context/AppThemeContext";
import {
  fetchTaskSessions,
  type TaskSessionDocument,
} from "@/lib/sanity/taskSessions";
import {
  createTask,
  fetchTasks,
  toggleTaskComplete,
  type TaskDocument,
} from "@/lib/sanity/tasks";
import { formatDurationLabel } from "@/lib/utils/time-wisdom";
import {
  getPreviousDaySeconds,
  selectRandomTasks,
} from "@/lib/utils/today";
import { useUser } from "@clerk/clerk-expo";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

export default function Today() {
  const { user } = useUser();
  const router = useRouter();
  const { colors } = useAppTheme();
  const [tasks, setTasks] = useState<TaskDocument[]>([]);
  const [todayTasks, setTodayTasks] = useState<TaskDocument[]>([]);
  const [sessions, setSessions] = useState<TaskSessionDocument[]>([]);
  const [capture, setCapture] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");

  const refreshToday = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      const [nextTasks, nextSessions] = await Promise.all([
        fetchTasks(user.id),
        fetchTaskSessions(user.id),
      ]);
      setTasks(nextTasks);
      setSessions(nextSessions);
      setTodayTasks(selectRandomTasks(nextTasks, 3));
    } catch (loadError) {
      console.error("Error loading Today:", loadError);
      setError("Could not load today. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void refreshToday();
    }, [refreshToday]),
  );

  const yesterdaySeconds = useMemo(
    () => getPreviousDaySeconds(sessions),
    [sessions],
  );
  const upNext = todayTasks[0] ?? null;
  const alsoToday = todayTasks.slice(1);
  const firstName = user?.firstName || user?.fullName?.split(" ")[0] || "there";

  const handleCapture = async () => {
    const nextTitle = capture.trim();
    if (!user || !nextTitle || isCreating) return;

    setIsCreating(true);
    setError("");
    try {
      const createdTask = await createTask({
        title: nextTitle,
        userId: user.id,
        estimatedMinutes: null,
      });
      setTasks((current) => [createdTask, ...current]);
      setTodayTasks((current) =>
        current.length < 3 ? [...current, createdTask] : current,
      );
      setCapture("");
    } catch (createError) {
      console.error("Error capturing task:", createError);
      setError("Could not add that task. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleComplete = async (task: TaskDocument) => {
    try {
      await toggleTaskComplete(task._id, true);
      const remainingTasks = tasks.map((currentTask) =>
        currentTask._id === task._id
          ? { ...currentTask, completed: true }
          : currentTask,
      );
      setTasks(remainingTasks);
      setTodayTasks(selectRandomTasks(remainingTasks, 3));
    } catch (completeError) {
      console.error("Error completing Today task:", completeError);
      setError("Could not complete that task. Please try again.");
    }
  };

  const openTasks = () => router.navigate("/(app)/(tabs)/Tasks");

  return (
    <AppScreen>
      <View style={styles.header}>
        <Text style={[styles.greeting, { color: colors.text }]}>
          Good afternoon, {firstName}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          {todayTasks.length === 0
            ? "Start with one small thing."
            : `${todayTasks.length} ${todayTasks.length === 1 ? "thing" : "things"} today. Start wherever feels right.`}
        </Text>
      </View>

      <View
        style={[
          styles.captureBar,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <TextInput
          accessibilityLabel="Capture a task"
          editable={!isCreating}
          onChangeText={setCapture}
          onSubmitEditing={() => void handleCapture()}
          placeholder="Capture anything..."
          placeholderTextColor={colors.textFaint}
          returnKeyType="done"
          style={[styles.captureInput, { color: colors.text }]}
          value={capture}
        />
        <Pressable
          accessibilityLabel="Add captured task"
          accessibilityRole="button"
          disabled={!capture.trim() || isCreating}
          onPress={() => void handleCapture()}
          style={({ pressed }) => [
            styles.captureButton,
            {
              backgroundColor: pressed ? colors.accentPressed : colors.accent,
              opacity: !capture.trim() || isCreating ? 0.5 : 1,
            },
          ]}
        >
          <Ionicons name="arrow-forward" color={colors.accentText} size={18} />
        </Pressable>
      </View>

      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}

      {isLoading ? (
        <StatusMessage loading>Finding three things for today...</StatusMessage>
      ) : todayTasks.length === 0 ? (
        <AppCard style={styles.emptyCard}>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No open tasks yet.</Text>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            Capture something above or add a task from the Tasks tab.
          </Text>
        </AppCard>
      ) : (
        <>
          <SectionLabel style={styles.sectionLabel}>Up next</SectionLabel>
          {upNext ? (
            <AppCard style={styles.upNextCard}>
              <View style={styles.taskTitleRow}>
                <CircleCheckbox
                  checked={false}
                  label={`Complete ${upNext.title}`}
                  onPress={() => void handleComplete(upNext)}
                />
                <Pressable
                  accessibilityRole="button"
                  onPress={openTasks}
                  style={styles.taskTextButton}
                >
                  <Text style={[styles.upNextTitle, { color: colors.text }]}>
                    {upNext.title}
                  </Text>
                  <Text style={[styles.estimate, { color: colors.textMuted }]}>
                    {upNext.estimatedMinutes == null
                      ? "No estimate yet"
                      : `Usually takes about ${upNext.estimatedMinutes} minutes`}
                  </Text>
                </Pressable>
              </View>
              <PrimaryButton
                accessibilityLabel={`Start focus for ${upNext.title}`}
                onPress={openTasks}
              >
                Start focus
              </PrimaryButton>
            </AppCard>
          ) : null}

          {alsoToday.length > 0 ? (
            <View style={styles.alsoSection}>
              <SectionLabel style={styles.sectionLabel}>Also today</SectionLabel>
              {alsoToday.map((task) => (
                <View
                  key={task._id}
                  style={[styles.alsoRow, { borderBottomColor: colors.border }]}
                >
                  <CircleCheckbox
                    checked={false}
                    label={`Complete ${task.title}`}
                    onPress={() => void handleComplete(task)}
                  />
                  <Pressable
                    accessibilityRole="button"
                    onPress={openTasks}
                    style={styles.taskTextButton}
                  >
                    <Text numberOfLines={2} style={[styles.alsoTitle, { color: colors.text }]}>
                      {task.title}
                    </Text>
                  </Pressable>
                  <Text style={[styles.rowEstimate, { color: colors.textMuted }]}>
                    {task.estimatedMinutes == null ? "—" : `${task.estimatedMinutes} min`}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </>
      )}

      <Pressable
        accessibilityRole="button"
        onPress={openTasks}
        style={styles.seeAllButton}
      >
        <Text style={[styles.seeAllText, { color: colors.accent }]}>See all tasks</Text>
        <Ionicons name="chevron-forward" color={colors.accent} size={14} />
      </Pressable>

      <Text style={[styles.encouragement, { color: colors.textMuted }]}>
        {yesterdaySeconds > 0
          ? `You showed up for ${formatDurationLabel(yesterdaySeconds)} yesterday.`
          : "A fresh start counts, too."}
      </Text>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: design.spacing.md,
    marginTop: design.spacing.xs,
  },
  greeting: {
    fontSize: design.type.title,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: design.type.body,
    lineHeight: 20,
    marginTop: design.spacing.xxs,
  },
  captureBar: {
    alignItems: "center",
    borderRadius: design.radius.pill,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: design.touchTarget,
    paddingLeft: design.spacing.md,
    paddingRight: 2,
  },
  captureInput: {
    flex: 1,
    fontSize: design.type.body,
    minHeight: design.touchTarget,
    paddingVertical: 0,
  },
  captureButton: {
    alignItems: "center",
    borderRadius: design.radius.pill,
    height: design.touchTarget,
    justifyContent: "center",
    width: design.touchTarget,
  },
  error: {
    fontSize: design.type.label,
    fontWeight: "700",
    marginTop: design.spacing.sm,
  },
  sectionLabel: {
    marginBottom: design.spacing.xs,
    marginTop: design.spacing.lg,
  },
  upNextCard: {
    gap: design.spacing.sm,
    padding: design.spacing.md,
  },
  taskTitleRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    marginLeft: -design.spacing.sm,
  },
  taskTextButton: {
    flex: 1,
    justifyContent: "center",
    minHeight: design.touchTarget,
  },
  upNextTitle: {
    fontSize: design.type.bodyLarge,
    fontWeight: "900",
    lineHeight: 22,
  },
  estimate: {
    fontSize: design.type.label,
    lineHeight: 17,
    marginTop: design.spacing.xxs,
  },
  alsoSection: {
    marginTop: design.spacing.xs,
  },
  alsoRow: {
    alignItems: "center",
    borderBottomWidth: 1,
    flexDirection: "row",
    marginLeft: -design.spacing.sm,
    minHeight: 52,
  },
  alsoTitle: {
    fontSize: design.type.body,
    fontWeight: "700",
    lineHeight: 19,
  },
  rowEstimate: {
    fontSize: design.type.caption,
    marginLeft: design.spacing.sm,
  },
  seeAllButton: {
    alignItems: "center",
    alignSelf: "center",
    flexDirection: "row",
    gap: 2,
    justifyContent: "center",
    marginTop: design.spacing.md,
    minHeight: design.touchTarget,
    paddingHorizontal: design.spacing.md,
  },
  seeAllText: {
    fontSize: design.type.label,
    fontWeight: "800",
  },
  encouragement: {
    fontSize: design.type.caption,
    lineHeight: 16,
    marginTop: design.spacing.xs,
    textAlign: "center",
  },
  emptyCard: {
    marginTop: design.spacing.xl,
  },
  emptyTitle: {
    fontSize: design.type.bodyLarge,
    fontWeight: "900",
  },
  emptyText: {
    fontSize: design.type.body,
    lineHeight: 20,
    marginTop: design.spacing.xs,
  },
});
