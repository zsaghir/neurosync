import { PillButton } from "@/components/ui/PillButton";
import { TaskRow } from "@/components/ui/TaskRow";
import {
  AppCard,
  AppScreen,
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
import { getPreviousDaySeconds, selectRandomTasks } from "@/lib/utils/today";
import { useUser } from "@clerk/clerk-expo";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter, type Href } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

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

  const openTaskDetails = (task: TaskDocument) =>
    router.push({
      pathname: "/(app)/(tabs)/Tasks/[id]",
      params: { id: task._id },
    } as unknown as Href);

  const startFocus = (task: TaskDocument) =>
    router.push({
      pathname: "/(app)/focus/[taskId]",
      params: { taskId: task._id },
    } as unknown as Href);

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
          placeholderTextColor={colors.textMuted}
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
          <Ionicons name="add" color={colors.accentText} size={20} />
        </Pressable>
      </View>

      {error ? (
        <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>
      ) : null}

      {isLoading ? (
        <StatusMessage loading>Finding three things for today...</StatusMessage>
      ) : todayTasks.length === 0 ? (
        <AppCard style={styles.emptyCard}>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            No open tasks yet.
          </Text>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            Capture something above or add a task from the Tasks tab.
          </Text>
        </AppCard>
      ) : (
        <>
          <SectionLabel style={styles.sectionLabel}>Up next</SectionLabel>
          {upNext ? (
            <AppCard style={styles.upNextCard}>
              <Text style={[styles.upNextTitle, { color: colors.text }]}>
                {upNext.title}
              </Text>
              <Text style={[styles.estimate, { color: colors.textMuted }]}>
                {upNext.estimatedMinutes == null
                  ? "No estimate yet"
                  : `Usually takes about ${upNext.estimatedMinutes} minutes`}
              </Text>
              <PillButton
                accessibilityLabel={`Start focus for ${upNext.title}`}
                onPress={() => startFocus(upNext)}
                style={{ marginTop: design.spacing.md }}
              >
                Start focus
              </PillButton>
            </AppCard>
          ) : null}

          {alsoToday.length > 0 ? (
            <View style={styles.alsoSection}>
              <SectionLabel style={styles.sectionLabel}>Also today</SectionLabel>
              {alsoToday.map((task) => (
                <TaskRow
                  key={task._id}
                  task={task}
                  onToggleComplete={() => void handleComplete(task)}
                  onPress={() => openTaskDetails(task)}
                />
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
        <Text style={[styles.seeAllText, { color: colors.accent }]}>
          See all tasks ›
        </Text>
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
    marginTop: design.spacing.xxs,
  },
  greeting: {
    fontSize: design.type.screenTitle - 2,
    fontWeight: "800",
  },
  subtitle: {
    fontSize: design.type.meta + 1,
    lineHeight: 20,
    marginTop: design.spacing.xxs,
  },
  captureBar: {
    alignItems: "center",
    borderRadius: design.radius.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: design.spacing.xs,
    minHeight: design.touchTarget,
    paddingLeft: design.spacing.md + 2,
    paddingRight: design.spacing.xxs,
    paddingVertical: design.spacing.xxs,
  },
  captureInput: {
    flex: 1,
    fontSize: design.type.body,
    minHeight: design.touchTarget - 10,
    paddingVertical: 0,
  },
  captureButton: {
    alignItems: "center",
    borderRadius: design.radius.pill,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  error: {
    fontSize: design.type.meta,
    fontWeight: "700",
    marginTop: design.spacing.sm,
  },
  sectionLabel: {
    marginBottom: design.spacing.sm - 2,
    marginTop: design.spacing.xl - 2,
  },
  upNextCard: {
    padding: design.spacing.lg,
  },
  upNextTitle: {
    fontSize: design.type.cardTitle,
    fontWeight: "700",
    lineHeight: 25,
  },
  estimate: {
    fontSize: design.type.body - 1,
    lineHeight: 18,
    marginTop: design.spacing.xs - 2,
  },
  alsoSection: {
    marginTop: design.spacing.xxs,
  },
  seeAllButton: {
    alignItems: "center",
    alignSelf: "center",
    justifyContent: "center",
    marginTop: design.spacing.sm,
    minHeight: design.touchTarget,
    paddingHorizontal: design.spacing.md,
  },
  seeAllText: {
    fontSize: design.type.body,
    fontWeight: "700",
  },
  encouragement: {
    fontSize: design.type.meta,
    lineHeight: 16,
    textAlign: "center",
  },
  emptyCard: {
    marginTop: design.spacing.xl,
  },
  emptyTitle: {
    fontSize: design.type.cardTitle - 1,
    fontWeight: "700",
  },
  emptyText: {
    fontSize: design.type.body,
    lineHeight: 20,
    marginTop: design.spacing.xs,
  },
});
