import Subtasks from "@/components/subtasks";
import TaskItem from "@/components/TaskItem";
import {
  fetchTaskSessions,
  type TaskSessionDocument,
} from "@/lib/sanity/taskSessions";
import {
  createTask,
  deleteTask,
  fetchTasks,
  toggleTaskComplete,
  type TaskDocument,
  type TaskInput,
} from "@/lib/sanity/tasks";
import {
  fetchUserSettings,
  type UserSettingsDocument,
} from "@/lib/sanity/userSettings";
import {
  DEFAULT_USER_TIME_SETTINGS,
  formatDurationLabel,
  getEstimateChoicesForMode,
  getTimeEstimationModeLabel,
  type EstimateInputType,
  type ThemeMode,
} from "@/lib/utils/time-wisdom";
import { useUser } from "@clerk/clerk-expo";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

const Tasks = () => {
  const { user } = useUser();
  const [tasks, setTasks] = useState<TaskDocument[]>([]);
  const [sessions, setSessions] = useState<TaskSessionDocument[]>([]);
  const [settings, setSettings] = useState<UserSettingsDocument | null>(null);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [title, setTitle] = useState("");
  const [selectedEstimateMinutes, setSelectedEstimateMinutes] = useState<
    number | null
  >(null);
  const [selectedEstimateType, setSelectedEstimateType] =
    useState<EstimateInputType>("skipped");
  const [customEstimate, setCustomEstimate] = useState("");
  const [titleError, setTitleError] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskDocument | null>(null);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [visibleSubtasks, setVisibleSubtasks] = useState<Record<string, boolean>>(
    {},
  );

  const activeSettings = settings ?? {
    _id: "default",
    userId: user?.id ?? "",
    ...DEFAULT_USER_TIME_SETTINGS,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const theme = pageThemes[activeSettings.themeMode];
  const addEstimateChoices = getEstimateChoicesForMode(
    activeSettings.preferredTimeEstimationMode,
  );

  const activeTasks = useMemo(
    () => tasks.filter((task) => !task.completed),
    [tasks],
  );
  const completedTasks = useMemo(
    () => tasks.filter((task) => task.completed),
    [tasks],
  );
  const selectedTaskFromList = selectedTask
    ? tasks.find((task) => task._id === selectedTask._id) ?? selectedTask
    : null;

  const loadTasks = useCallback(async () => {
    if (!user) {
      setIsLoadingTasks(false);
      return;
    }

    try {
      setIsLoadingTasks(true);
      const [userTasks, userSessions, userSettings] = await Promise.all([
        fetchTasks(user.id),
        fetchTaskSessions(user.id),
        fetchUserSettings(user.id),
      ]);
      setTasks(userTasks);
      setSessions(userSessions);
      setSettings(userSettings);
    } catch (error) {
      console.error("Error fetching tasks:", error);
    } finally {
      setIsLoadingTasks(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadTasks();
    }, [loadTasks]),
  );

  const resetAddTaskForm = () => {
    setTitle("");
    setTitleError("");
    setSelectedEstimateMinutes(null);
    setSelectedEstimateType("skipped");
    setCustomEstimate("");
  };

  const openAddTask = () => {
    resetAddTaskForm();
    setIsAddOpen(true);
  };

  const closeAddTask = () => {
    setIsAddOpen(false);
    resetAddTaskForm();
  };

  const handleEstimateChoice = (
    minutes: number | null,
    inputType: EstimateInputType,
  ) => {
    setSelectedEstimateMinutes(minutes);
    setSelectedEstimateType(inputType);
  };

  const getTaskEstimateMinutes = () => {
    if (activeSettings.preferredTimeEstimationMode !== "custom") {
      return selectedEstimateMinutes;
    }

    if (selectedEstimateType === "skipped") return null;

    const parsedEstimate = Number(customEstimate);
    return Number.isFinite(parsedEstimate) && parsedEstimate > 0
      ? Math.round(parsedEstimate)
      : null;
  };

  const handleAddTask = async () => {
    if (!user || isAddingTask) return;

    if (!title.trim()) {
      setTitleError("Please enter a task title.");
      return;
    }

    setIsAddingTask(true);
    setTitleError("");

    try {
      const createdTask = await createTask({
        title: title.trim(),
        userId: user.id,
        estimatedMinutes: getTaskEstimateMinutes(),
      });

      setTasks((currentTasks) => [createdTask, ...currentTasks]);
      closeAddTask();
    } catch (error) {
      console.error("Error adding task:", error);
      setTitleError("Could not add this task. Please try again.");
    } finally {
      setIsAddingTask(false);
    }
  };

  const handleToggleTask = async (task: TaskDocument) => {
    await toggleTaskComplete(task._id, !task.completed);
    setTasks((currentTasks) =>
      currentTasks.map((currentTask) =>
        currentTask._id === task._id
          ? { ...currentTask, completed: !currentTask.completed }
          : currentTask,
      ),
    );
  };

  const handleDeleteTask = async (taskId: string) => {
    await deleteTask(taskId);
    setSelectedTask((currentTask) =>
      currentTask?._id === taskId ? null : currentTask,
    );
    setTasks((currentTasks) =>
      currentTasks.filter((currentTask) => currentTask._id !== taskId),
    );
  };

  const handleTimeCommitted = (taskId: string, seconds: number) => {
    setTasks((currentTasks) =>
      currentTasks.map((currentTask) =>
        currentTask._id === taskId
          ? {
              ...currentTask,
              timeSpentSeconds:
                (currentTask.timeSpentSeconds ?? 0) + Math.round(seconds),
            }
          : currentTask,
      ),
    );
  };

  const handleCompleteTask = async (taskId: string) => {
    await toggleTaskComplete(taskId, true);
    setTasks((currentTasks) =>
      currentTasks.map((currentTask) =>
        currentTask._id === taskId
          ? { ...currentTask, completed: true }
          : currentTask,
      ),
    );
  };

  const handleSessionSaved = (session: TaskSessionDocument) => {
    setSessions((currentSessions) => [session, ...currentSessions]);
  };

  const toggleSubtasks = (taskId: string) => {
    setVisibleSubtasks((current) => ({
      ...current,
      [taskId]: !current[taskId],
    }));
  };

  const handleSubtasksChanged = (
    taskId: string,
    subtasks: NonNullable<TaskInput["subtasks"]>,
  ) => {
    setTasks((currentTasks) =>
      currentTasks.map((currentTask) =>
        currentTask._id === taskId ? { ...currentTask, subtasks } : currentTask,
      ),
    );
  };

  const getCompletedSubtasksCount = (task: TaskDocument) => {
    return (task.subtasks ?? []).filter((subtask) => subtask.completed).length;
  };

  const renderTask = (task: TaskDocument) => {
    const hasTime = (task.timeSpentSeconds ?? 0) > 0;
    const hasEstimate = task.estimatedMinutes != null;
    const subtasks = task.subtasks ?? [];
    const hasSubtasks = subtasks.length > 0;
    const isExpanded = Boolean(visibleSubtasks[task._id]);

    return (
      <View key={task._id} style={styles.taskGroup}>
        <View style={[styles.taskRow, { borderColor: theme.line }]}>
          <Pressable
            style={styles.chevronButton}
            onPress={() => toggleSubtasks(task._id)}
          >
            <Ionicons
              name={isExpanded ? "chevron-down" : "chevron-forward"}
              size={19}
              color={theme.subtle}
            />
          </Pressable>

          <Pressable
            style={[
              styles.circle,
              {
                borderColor: theme.subtle,
                backgroundColor: task.completed ? theme.text : "transparent",
              },
            ]}
            onPress={() => handleToggleTask(task)}
          >
            {task.completed ? (
              <Ionicons name="checkmark" size={16} color={theme.background} />
            ) : null}
          </Pressable>

          <Pressable
            style={styles.taskTextArea}
            onPress={() => setSelectedTask(task)}
          >
            <Text
              style={[
                styles.taskName,
                { color: theme.text },
                task.completed && styles.completedTaskName,
              ]}
            >
              {task.title}
            </Text>
            {hasSubtasks ? (
              <View style={styles.subtaskCountRow}>
                <Ionicons
                  name="git-branch-outline"
                  size={14}
                  color={theme.subtle}
                />
                <Text style={[styles.subtaskCount, { color: theme.subtle }]}>
                  {getCompletedSubtasksCount(task)}/{subtasks.length}
                </Text>
              </View>
            ) : null}
          </Pressable>

          <View style={styles.metaCluster}>
            {hasEstimate || hasTime ? (
              <View style={styles.timePill}>
                <Ionicons name="time-outline" size={16} color={theme.subtle} />
                <Text style={[styles.timeText, { color: theme.subtle }]}>
                  {hasTime
                    ? formatDurationLabel(task.timeSpentSeconds)
                    : `${task.estimatedMinutes} min`}
                </Text>
              </View>
            ) : null}

            {user && !task.completed ? (
              <TaskItem
                task={task}
                userId={user.id}
                sessions={sessions}
                themeMode={activeSettings.themeMode}
                onTimeCommitted={handleTimeCommitted}
                onComplete={handleCompleteTask}
                onSessionSaved={handleSessionSaved}
              />
            ) : null}
          </View>
        </View>

        {user ? (
          <Subtasks
            task={task}
            userId={user.id}
            isVisible={isExpanded}
            theme={theme}
            onSubtasksChanged={handleSubtasksChanged}
          />
        ) : null}
      </View>
    );
  };

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.contentContainer}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.panel}>
        <Text style={[styles.title, { color: theme.text }]}>To dos</Text>

        <View style={styles.taskList}>
          {isLoadingTasks ? (
            <Text style={[styles.statusText, { color: theme.subtle }]}>
              Loading tasks...
            </Text>
          ) : tasks.length === 0 ? (
            <Text style={[styles.statusText, { color: theme.subtle }]}>
              No tasks yet. Add your first task.
            </Text>
          ) : (
            <>
              {activeTasks.map(renderTask)}
              {completedTasks.length > 0 ? (
                <Text style={[styles.sectionLabel, { color: theme.subtle }]}>
                  Completed
                </Text>
              ) : null}
              {completedTasks.map(renderTask)}
            </>
          )}
        </View>

        <Pressable
          style={[styles.addButton, { borderColor: theme.line }]}
          onPress={openAddTask}
        >
          <Ionicons name="add" size={20} color={theme.text} />
          <Text style={[styles.addButtonText, { color: theme.text }]}>
            Add task
          </Text>
        </Pressable>
      </View>

      <Modal
        animationType="fade"
        transparent
        visible={isAddOpen}
        onRequestClose={closeAddTask}
      >
        <View style={styles.overlay}>
          <View
            style={[
              styles.addModal,
              { backgroundColor: theme.modal, borderColor: theme.line },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                New task
              </Text>
              <Pressable onPress={closeAddTask}>
                <Ionicons name="close" size={22} color={theme.text} />
              </Pressable>
            </View>

            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.input,
                  borderColor: theme.line,
                  color: theme.text,
                },
              ]}
              placeholder="Enter title"
              placeholderTextColor={theme.subtle}
              value={title}
              onChangeText={(text) => {
                setTitle(text);
                if (titleError) setTitleError("");
              }}
            />

            <View style={styles.estimateBlock}>
              <Text style={[styles.preferenceLabel, { color: theme.text }]}>
                Estimated time
              </Text>
              <Text style={[styles.settingHint, { color: theme.subtle }]}>
                {getTimeEstimationModeLabel(
                  activeSettings.preferredTimeEstimationMode,
                )}
              </Text>

              {activeSettings.preferredTimeEstimationMode === "custom" ? (
                <View style={styles.customEstimateRow}>
                  <TextInput
                    style={[
                      styles.customEstimateInput,
                      {
                        backgroundColor: theme.input,
                        borderColor: theme.line,
                        color: theme.text,
                      },
                    ]}
                    placeholder="Minutes"
                    placeholderTextColor={theme.subtle}
                    keyboardType="numeric"
                    value={customEstimate}
                    onChangeText={(value) => {
                      setCustomEstimate(value);
                      setSelectedEstimateType("custom");
                    }}
                  />
                  <Pressable
                    style={[
                      styles.estimateChip,
                      { borderColor: theme.line },
                      selectedEstimateType === "skipped" &&
                        styles.selectedEstimateChip,
                    ]}
                    onPress={() => {
                      setSelectedEstimateMinutes(null);
                      setSelectedEstimateType("skipped");
                      setCustomEstimate("");
                    }}
                  >
                    <Text style={[styles.estimateChipText, { color: theme.text }]}>
                      Skip estimation
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.estimateChoices}>
                  {addEstimateChoices.map((choice) => (
                    <Pressable
                      key={`${choice.label}-${choice.inputType}`}
                      style={[
                        styles.estimateChip,
                        { borderColor: theme.line },
                        selectedEstimateMinutes === choice.minutes &&
                          selectedEstimateType === choice.inputType &&
                          styles.selectedEstimateChip,
                      ]}
                      onPress={() =>
                        handleEstimateChoice(choice.minutes, choice.inputType)
                      }
                    >
                      <Text
                        style={[styles.estimateChipText, { color: theme.text }]}
                      >
                        {choice.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            {titleError ? (
              <Text style={styles.errorText}>{titleError}</Text>
            ) : null}

            <Pressable
              style={[styles.saveButton, isAddingTask && styles.disabledButton]}
              onPress={handleAddTask}
              disabled={isAddingTask}
            >
              <Text style={styles.saveButtonText}>
                {isAddingTask ? "Adding..." : "Add task"}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        transparent
        visible={Boolean(selectedTaskFromList)}
        onRequestClose={() => setSelectedTask(null)}
      >
        <View style={styles.overlay}>
          {selectedTaskFromList ? (
            <View
              style={[
                styles.detailModal,
                { backgroundColor: theme.modal, borderColor: theme.line },
              ]}
            >
              <View style={styles.modalHeader}>
                <View style={styles.detailTitleRow}>
                  <Pressable
                    style={[
                      styles.circle,
                      {
                        borderColor: theme.subtle,
                        backgroundColor: selectedTaskFromList.completed
                          ? theme.text
                          : "transparent",
                      },
                    ]}
                    onPress={() => handleToggleTask(selectedTaskFromList)}
                  >
                    {selectedTaskFromList.completed ? (
                      <Ionicons
                        name="checkmark"
                        size={16}
                        color={theme.background}
                      />
                    ) : null}
                  </Pressable>
                  <Text style={[styles.detailTitle, { color: theme.text }]}>
                    {selectedTaskFromList.title}
                  </Text>
                </View>
                <Pressable onPress={() => setSelectedTask(null)}>
                  <Ionicons name="close" size={22} color={theme.text} />
                </Pressable>
              </View>

              <View style={styles.descriptionRow}>
                <Ionicons name="menu-outline" size={20} color={theme.subtle} />
                <Text style={[styles.descriptionText, { color: theme.subtle }]}>
                  Description
                </Text>
              </View>

              <View style={styles.detailMetaRow}>
                {selectedTaskFromList.estimatedMinutes != null ? (
                  <Text style={[styles.detailMetaText, { color: theme.subtle }]}>
                    Estimated {selectedTaskFromList.estimatedMinutes} min
                  </Text>
                ) : null}
                {(selectedTaskFromList.timeSpentSeconds ?? 0) > 0 ? (
                  <Text style={[styles.detailMetaText, { color: theme.subtle }]}>
                    Actual{" "}
                    {formatDurationLabel(selectedTaskFromList.timeSpentSeconds)}
                  </Text>
                ) : null}
              </View>

              {user && !selectedTaskFromList.completed ? (
                <View style={styles.detailTimerRow}>
                  <Text style={[styles.preferenceLabel, { color: theme.text }]}>
                    Timer
                  </Text>
                  <TaskItem
                    task={selectedTaskFromList}
                    userId={user.id}
                    sessions={sessions}
                    themeMode={activeSettings.themeMode}
                    onTimeCommitted={handleTimeCommitted}
                    onComplete={handleCompleteTask}
                    onSessionSaved={handleSessionSaved}
                  />
                </View>
              ) : null}

              <View style={styles.detailSubtasksHeader}>
                <Pressable
                  style={styles.detailSubtasksTitle}
                  onPress={() => toggleSubtasks(selectedTaskFromList._id)}
                >
                  <Ionicons
                    name={
                      visibleSubtasks[selectedTaskFromList._id]
                        ? "chevron-down"
                        : "chevron-forward"
                    }
                    size={20}
                    color={theme.subtle}
                  />
                  <Text style={[styles.detailSubtasksText, { color: theme.text }]}>
                    Sub-tasks {getCompletedSubtasksCount(selectedTaskFromList)}/
                    {(selectedTaskFromList.subtasks ?? []).length}
                  </Text>
                </Pressable>
              </View>

              {user ? (
                <Subtasks
                  task={selectedTaskFromList}
                  userId={user.id}
                  isVisible={Boolean(visibleSubtasks[selectedTaskFromList._id])}
                  theme={theme}
                  onSubtasksChanged={handleSubtasksChanged}
                />
              ) : null}

              <Pressable
                style={styles.deleteTextButton}
                onPress={() => handleDeleteTask(selectedTaskFromList._id)}
              >
                <Text style={[styles.deleteText, { color: theme.subtle }]}>
                  Delete task
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </Modal>
    </ScrollView>
  );
};

export default Tasks;

type PageTheme = {
  background: string;
  row: string;
  modal: string;
  input: string;
  line: string;
  text: string;
  subtle: string;
};

const pageThemes: Record<ThemeMode, PageTheme> = {
  dark: {
    background: "#1f1f1f",
    row: "transparent",
    modal: "#202020",
    input: "#171717",
    line: "#3e3e3e",
    text: "#f8f5ee",
    subtle: "#aaa6a0",
  },
  light: {
    background: "#fbf7ef",
    row: "transparent",
    modal: "#fffdf8",
    input: "#f6efe4",
    line: "#d6cec2",
    text: "#25231f",
    subtle: "#6f685f",
  },
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 32,
  },
  panel: {
    flex: 1,
    maxWidth: 820,
    minHeight: 680,
    width: "100%",
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 22,
    textAlign: "center",
  },
  taskList: {
    paddingBottom: 28,
  },
  statusText: {
    fontSize: 16,
    textAlign: "center",
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 8,
    marginTop: 18,
    textTransform: "uppercase",
  },
  taskGroup: {
    width: "100%",
  },
  taskRow: {
    alignItems: "center",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 62,
    paddingVertical: 8,
  },
  chevronButton: {
    alignItems: "center",
    height: 36,
    justifyContent: "center",
    width: 28,
  },
  circle: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 2,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  taskTextArea: {
    flex: 1,
    minWidth: 80,
  },
  taskName: {
    fontSize: 19,
    fontWeight: "800",
    lineHeight: 24,
  },
  completedTaskName: {
    textDecorationLine: "line-through",
  },
  subtaskCountRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
    marginTop: 4,
  },
  subtaskCount: {
    fontSize: 14,
    fontWeight: "700",
  },
  metaCluster: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  timePill: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
  },
  timeText: {
    fontSize: 14,
    fontWeight: "800",
  },
  addButton: {
    alignItems: "center",
    alignSelf: "flex-end",
    borderRadius: 4,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    marginTop: 28,
    minHeight: 50,
    minWidth: 170,
    paddingHorizontal: 18,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: "800",
  },
  overlay: {
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.54)",
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
  addModal: {
    borderRadius: 12,
    borderWidth: 1,
    gap: 14,
    maxWidth: 520,
    padding: 20,
    width: "100%",
  },
  detailModal: {
    borderRadius: 12,
    borderWidth: 1,
    gap: 18,
    maxWidth: 680,
    padding: 22,
    width: "100%",
  },
  modalHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 14,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "900",
  },
  detailTitleRow: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 14,
  },
  detailTitle: {
    flex: 1,
    fontSize: 30,
    fontWeight: "900",
    lineHeight: 36,
  },
  descriptionRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  descriptionText: {
    fontSize: 18,
    fontWeight: "700",
  },
  detailMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  detailMetaText: {
    fontSize: 14,
    fontWeight: "800",
  },
  detailTimerRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  detailSubtasksHeader: {
    marginTop: 2,
  },
  detailSubtasksTitle: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  detailSubtasksText: {
    fontSize: 20,
    fontWeight: "900",
  },
  input: {
    borderRadius: 4,
    borderWidth: 1,
    fontSize: 16,
    minHeight: 46,
    paddingHorizontal: 12,
  },
  estimateBlock: {
    gap: 10,
  },
  preferenceLabel: {
    fontSize: 15,
    fontWeight: "800",
  },
  settingHint: {
    fontSize: 13,
    fontWeight: "700",
  },
  estimateChoices: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  estimateChip: {
    alignItems: "center",
    borderRadius: 4,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 36,
    paddingHorizontal: 12,
  },
  selectedEstimateChip: {
    backgroundColor: "#9ccf9b",
    borderColor: "#315f30",
  },
  estimateChipText: {
    fontSize: 13,
    fontWeight: "800",
  },
  customEstimateRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    width: "100%",
  },
  customEstimateInput: {
    borderRadius: 4,
    borderWidth: 1,
    flex: 1,
    fontSize: 15,
    minHeight: 38,
    minWidth: 140,
    paddingHorizontal: 10,
  },
  errorText: {
    color: "#ff7b7b",
    fontSize: 13,
    fontWeight: "700",
  },
  saveButton: {
    alignItems: "center",
    backgroundColor: "#9ccf9b",
    borderRadius: 4,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 16,
  },
  saveButtonText: {
    color: "#050505",
    fontSize: 15,
    fontWeight: "900",
  },
  disabledButton: {
    opacity: 0.6,
  },
  deleteTextButton: {
    alignSelf: "flex-start",
    marginTop: 4,
  },
  deleteText: {
    fontSize: 14,
    fontWeight: "800",
  },
});
