import { AddTaskSheet } from "@/components/tasks/AddTaskSheet";
import { TaskRow } from "@/components/ui/TaskRow";
import { design } from "@/constants/design";
import { useAppTheme } from "@/context/AppThemeContext";
import { useUserSettings } from "@/hooks/queries/settings";
import { addTaskToCache, useTasks, useToggleTaskComplete } from "@/hooks/queries/tasks";
import { useQueryScope } from "@/hooks/queries/use-query-scope";
import { useRefreshOnFocus } from "@/hooks/use-refresh-on-focus";
import { useSingleNavigation } from "@/hooks/use-single-navigation";
import { taskErrorMessage } from "@/lib/api/client";
import type { TaskDocument } from "@/lib/api/tasks";
import { queryKeys } from "@/lib/query/keys";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useQueryClient } from "@tanstack/react-query";
import { type Href } from "expo-router";
import React, { useEffect, useState } from "react";
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
  const { isAuthLoaded, isSignedIn, userId, scope } = useQueryScope();
  const { colors } = useAppTheme();
  const queryClient = useQueryClient();
  const navigate = useSingleNavigation();

  const tasksQuery = useTasks();
  // Optional display preferences; a failure here must not block the list.
  const settingsQuery = useUserSettings();
  const completion = useToggleTaskComplete();
  useRefreshOnFocus(userId ? queryKeys.tasks(userId) : null);

  const tasks = tasksQuery.data ?? [];
  const settings = settingsQuery.data ?? null;
  const error = completion.error
    ? taskErrorMessage(completion.error, "Couldn't save completion. Please retry.")
    : tasksQuery.error
      ? taskErrorMessage(tasksQuery.error, "Couldn't load your tasks. Check your connection and retry.")
      : "";
  // Only a list with no data yet shows the spinner. A background refresh keeps
  // the current rows on screen.
  const isFirstLoad = userId != null && tasksQuery.isPending;

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isCompletedExpanded, setIsCompletedExpanded] = useState(false);

  useEffect(() => { setIsAddOpen(false); setIsCompletedExpanded(false); }, [userId]);

  const activeTasks = tasks.filter((task) => !task.completed);
  const completedTasks = tasks.filter((task) => task.completed);

  const retry = () => {
    completion.reset();
    void tasksQuery.refetch();
  };

  const openTaskDetails = (task: TaskDocument) =>
    navigate({
      pathname: "/(app)/(tabs)/Tasks/[id]",
      params: { id: task._id },
    } as unknown as Href);

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={styles.screen}>
        <Text style={[styles.title, { color: colors.text }]}>Tasks</Text>

        {!!error && (
          <View style={[styles.errorCard, { backgroundColor: colors.dangerSoft }]}>
            <Text accessibilityRole="alert" style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
            <Pressable accessibilityRole="button" onPress={retry}>
              <Text style={[styles.retryText, { color: colors.danger }]}>Retry</Text>
            </Pressable>
          </View>
        )}

        {!isAuthLoaded || isFirstLoad ? (
          <View style={styles.statusBlock}>
            <ActivityIndicator color={colors.accent} />
            <Text style={[styles.statusText, { color: colors.textMuted }]}>
              Loading your tasks…
            </Text>
          </View>
        ) : !isSignedIn ? <Text>Please sign in to view your tasks.</Text>
          : !tasksQuery.data ? null : tasks.length === 0 ? (
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
                onToggleComplete={() => completion.toggle(task)}
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
                        onToggleComplete={() => completion.toggle(task)}
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

      {isSignedIn ? (
        <AddTaskSheet
          visible={isAddOpen}
          onClose={() => setIsAddOpen(false)}
          timeSettings={settings}
          onCreated={(task) => addTaskToCache(queryClient, scope, task)}
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
