import { AddTaskSheet } from "@/components/tasks/AddTaskSheet";
import { TaskRow } from "@/components/ui/TaskRow";
import { design } from "@/constants/design";
import { useAppTheme } from "@/context/AppThemeContext";
import {
  fetchTasks,
  toggleTaskComplete,
  type TaskDocument,
} from "@/lib/sanity/tasks";
import {
  fetchUserSettings,
  type UserSettingsDocument,
} from "@/lib/sanity/userSettings";
import { useUser } from "@clerk/clerk-expo";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter, type Href } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function TasksList() {
  const { user } = useUser();
  const router = useRouter();
  const { colors } = useAppTheme();

  const [tasks, setTasks] = useState<TaskDocument[]>([]);
  const [settings, setSettings] = useState<UserSettingsDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isCompletedExpanded, setIsCompletedExpanded] = useState(false);

  const loadTasks = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      const [userTasks, userSettings] = await Promise.all([
        fetchTasks(user.id),
        fetchUserSettings(user.id),
      ]);
      setTasks(userTasks);
      setSettings(userSettings);
    } catch (loadError) {
      console.error("Error fetching tasks:", loadError);
      setError("We couldn't load your tasks. Check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void loadTasks();
    }, [loadTasks]),
  );

  const activeTasks = useMemo(() => tasks.filter((task) => !task.completed), [tasks]);
  const completedTasks = useMemo(() => tasks.filter((task) => task.completed), [tasks]);

  const handleToggleTask = async (task: TaskDocument) => {
    const nextCompleted = !task.completed;
    setTasks((current) =>
      current.map((currentTask) =>
        currentTask._id === task._id
          ? { ...currentTask, completed: nextCompleted }
          : currentTask,
      ),
    );
    try {
      await toggleTaskComplete(task._id, nextCompleted);
    } catch (toggleError) {
      console.error("Error toggling task:", toggleError);
      setTasks((current) =>
        current.map((currentTask) =>
          currentTask._id === task._id
            ? { ...currentTask, completed: task.completed }
            : currentTask,
        ),
      );
    }
  };

  const openTaskDetails = (task: TaskDocument) =>
    router.push({
      pathname: "/(app)/(tabs)/Tasks/[id]",
      params: { id: task._id },
    } as unknown as Href);

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={styles.screen}>
        <Text style={[styles.title, { color: colors.text }]}>Tasks</Text>

        {isLoading ? (
          <View style={styles.statusBlock}>
            <ActivityIndicator color={colors.accent} />
            <Text style={[styles.statusText, { color: colors.textMuted }]}>
              Loading your tasks…
            </Text>
          </View>
        ) : error ? (
          <View style={[styles.errorCard, { backgroundColor: colors.dangerSoft }]}>
            <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
            <Pressable
              onPress={() => void loadTasks()}
              style={[
                styles.retryButton,
                { backgroundColor: colors.surface, borderColor: colors.danger },
              ]}
            >
              <Text style={[styles.retryText, { color: colors.danger }]}>Retry</Text>
            </Pressable>
          </View>
        ) : tasks.length === 0 ? (
          <View style={styles.emptyBlock}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              Nothing on your list yet.
            </Text>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              Add your first task whenever you&rsquo;re ready.
            </Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {activeTasks.map((task) => (
              <TaskRow
                key={task._id}
                task={task}
                onToggleComplete={() => void handleToggleTask(task)}
                onPress={() => openTaskDetails(task)}
              />
            ))}

            {completedTasks.length > 0 ? (
              <>
                <Pressable
                  style={styles.completedRow}
                  onPress={() => setIsCompletedExpanded((open) => !open)}
                >
                  <Text style={[styles.completedLabel, { color: colors.textMuted }]}>
                    Completed ({completedTasks.length})
                  </Text>
                  <Ionicons
                    name={isCompletedExpanded ? "chevron-down" : "chevron-forward"}
                    size={15}
                    color={colors.borderStrong}
                  />
                </Pressable>
                {isCompletedExpanded
                  ? completedTasks.map((task) => (
                      <TaskRow
                        key={task._id}
                        task={task}
                        onToggleComplete={() => void handleToggleTask(task)}
                        onPress={() => openTaskDetails(task)}
                      />
                    ))
                  : null}
              </>
            ) : null}
          </ScrollView>
        )}

        <Pressable
          accessibilityLabel="Add task"
          accessibilityRole="button"
          onPress={() => setIsAddOpen(true)}
          style={[styles.fab, { backgroundColor: colors.accent }]}
        >
          <Ionicons name="add" size={26} color={colors.accentText} />
        </Pressable>
      </View>

      {user ? (
        <AddTaskSheet
          visible={isAddOpen}
          onClose={() => setIsAddOpen(false)}
          userId={user.id}
          timeSettings={settings}
          onCreated={(task) => setTasks((current) => [task, ...current])}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: design.spacing.lg,
    paddingTop: design.spacing.md,
  },
  title: {
    fontSize: design.type.screenTitle,
    fontWeight: "800",
    marginBottom: design.spacing.sm + 2,
  },
  listContent: {
    paddingBottom: design.spacing.huge * 2,
  },
  statusBlock: {
    alignItems: "center",
    gap: design.spacing.sm,
    paddingTop: design.spacing.xxl,
  },
  statusText: {
    fontSize: design.type.body,
  },
  errorCard: {
    borderRadius: design.radius.lg,
    padding: design.spacing.lg,
  },
  errorText: {
    fontSize: design.type.body,
    lineHeight: 20,
  },
  retryButton: {
    alignItems: "center",
    borderRadius: design.radius.pill,
    borderWidth: 1,
    justifyContent: "center",
    marginTop: design.spacing.md,
    minHeight: 42,
  },
  retryText: {
    fontSize: design.type.meta + 1,
    fontWeight: "700",
  },
  emptyBlock: {
    alignItems: "center",
    paddingTop: design.spacing.huge,
  },
  emptyTitle: {
    fontSize: design.type.cardTitle - 2,
    fontWeight: "700",
  },
  emptyText: {
    fontSize: design.type.body,
    lineHeight: 20,
    marginTop: design.spacing.xs,
    maxWidth: 240,
    textAlign: "center",
  },
  completedRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: design.touchTarget,
    paddingVertical: design.spacing.sm,
  },
  completedLabel: {
    fontSize: design.type.meta + 1,
    fontWeight: "700",
  },
  fab: {
    alignItems: "center",
    borderRadius: 28,
    bottom: design.spacing.lg,
    height: 56,
    justifyContent: "center",
    position: "absolute",
    right: design.spacing.lg,
    width: 56,
    ...design.shadow,
  },
});
