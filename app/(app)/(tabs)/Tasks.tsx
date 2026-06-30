import Subtasks from "@/components/subtasks";
import TaskItem from "@/components/TaskItem";
import {
  fetchTaskSessions,
  getComparableSessionSeconds,
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
  ESTIMATE_CHOICES,
  type EstimateInputType,
} from "@/lib/utils/time-wisdom";
import { useUser } from "@clerk/clerk-expo";
import React, { useCallback, useEffect, useState } from "react";
import {
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
  const [title, setTitle] = useState("");
  const [selectedEstimateMinutes, setSelectedEstimateMinutes] = useState<
    number | null
  >(null);
  const [selectedEstimateType, setSelectedEstimateType] =
    useState<EstimateInputType>("skipped");
  const [customEstimate, setCustomEstimate] = useState("");
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [titleError, setTitleError] = useState("");
  const [visibleSubtasks, setVisibleSubtasks] = useState<
    Record<string, boolean>
  >({});
  console.log("user in tasks screen", user);
  const loadTasks = useCallback(async () => {
    if (!user) return;
    try {
      setIsLoadingTasks(true);

      const [userTasks, userSessions] = await Promise.all([
        fetchTasks(user.id),
        fetchTaskSessions(user.id),
      ]);
      setTasks(userTasks);
      setSessions(userSessions);
    } catch (error) {
      console.error("Error fetching tasks:", error);
    } finally {
      setIsLoadingTasks(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setIsLoadingTasks(false);
      return;
    }

    loadTasks();
  }, [loadTasks, user]);

  const handleAddTask = async () => {
    if (user) {
      if (!title.trim()) {
        setTitleError("Please enter a task title.");
        return;
      }
      setTitleError("");
      const newTaskInput: TaskInput = {
        title: title.trim(),
        userId: user.id,
        estimatedMinutes: selectedEstimateMinutes,
      };

      const createdTask = await createTask(newTaskInput);
      setTasks((currentTasks) => [createdTask, ...currentTasks]);
      setTitle("");
      setSelectedEstimateMinutes(null);
      setSelectedEstimateType("skipped");
    }
  };

  const handleEstimateChoice = (
    minutes: number | null,
    inputType: EstimateInputType,
  ) => {
    setSelectedEstimateMinutes(minutes);
    setSelectedEstimateType(inputType);
  };

  const handleCustomEstimate = () => {
    const parsedEstimate = Number(customEstimate);
    const minutes =
      Number.isFinite(parsedEstimate) && parsedEstimate > 0
        ? Math.round(parsedEstimate)
        : null;

    setSelectedEstimateMinutes(minutes);
    setSelectedEstimateType(minutes == null ? "skipped" : "custom");
    setCustomEstimate("");
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

  const formatTime = (seconds = 0) => {
    const totalSeconds = Math.floor(seconds);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const remainingSeconds = totalSeconds % 60;

    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
      2,
      "0",
    )}:${String(remainingSeconds).padStart(2, "0")}`;
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.contentContainer}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.panel}>
        <Text style={styles.title}>Your Tasklist</Text>

        <View style={styles.addTaskContainer}>
          <TextInput
            style={styles.input}
            placeholder="Add task"
            placeholderTextColor="#8f8f8f"
            value={title}
            onChangeText={(text) => {
              setTitle(text);
              if (titleError) setTitleError("");
            }}
          />
          <View style={styles.estimateBlock}>
            <Text style={styles.estimatePrompt}>
              How long does this feel like?
            </Text>
            <View style={styles.estimateChoices}>
              {ESTIMATE_CHOICES.map((choice) => (
                <Pressable
                  key={`${choice.label}-${choice.inputType}`}
                  style={[
                    styles.estimateChip,
                    selectedEstimateMinutes === choice.minutes &&
                      selectedEstimateType === choice.inputType &&
                      styles.selectedEstimateChip,
                  ]}
                  onPress={() =>
                    handleEstimateChoice(choice.minutes, choice.inputType)
                  }
                >
                  <Text style={styles.estimateChipText}>{choice.label}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.customEstimateRow}>
              <TextInput
                style={styles.customEstimateInput}
                placeholder="Custom min"
                placeholderTextColor="#8f8f8f"
                keyboardType="numeric"
                value={customEstimate}
                onChangeText={setCustomEstimate}
              />
              <Pressable
                style={styles.smallButton}
                onPress={handleCustomEstimate}
              >
                <Text style={styles.smallButtonText}>Set</Text>
              </Pressable>
            </View>
          </View>
          <Pressable style={styles.primaryButton} onPress={handleAddTask}>
            <Text style={styles.primaryButtonText}>Add Task</Text>
          </Pressable>
        </View>

        {titleError ? <Text style={styles.errorText}>{titleError}</Text> : null}

        <View style={styles.taskList}>
          {isLoadingTasks ? (
            <Text style={styles.statusText}>Loading tasks...</Text>
          ) : tasks.length === 0 ? (
            <Text style={styles.statusText}>
              No tasks yet. Add your first task.
            </Text>
          ) : (
            tasks.map((task) => (
              <View key={task._id} style={styles.taskItem}>
                <View style={styles.taskMainRow}>
                  <Text
                    style={[
                      styles.taskName,
                      task.completed && styles.completedTaskName,
                    ]}
                  >
                    {task.title}
                  </Text>

                  <Pressable
                    style={[
                      styles.taskButton,
                      task.completed && styles.checkedButton,
                    ]}
                    onPress={() => handleToggleTask(task)}
                  >
                    <Text style={styles.taskButtonText}>
                      {task.completed ? "Checked" : "Check"}
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[styles.taskButton, styles.deleteButton]}
                    onPress={() => handleDeleteTask(task._id)}
                  >
                    <Text style={styles.taskButtonText}>Delete</Text>
                  </Pressable>
                </View>

                {task.completed ? (
                  <View style={styles.taskMetaRow}>
                    <Text style={styles.timeText}>
                      Time taken to complete:{" "}
                      {formatTime(task.timeSpentSeconds)}
                    </Text>
                  </View>
                ) : null}

                {user ? (
                  <Subtasks
                    task={task}
                    userId={user.id}
                    isVisible={Boolean(visibleSubtasks[task._id])}
                    onToggleVisible={toggleSubtasks}
                    onSubtasksChanged={handleSubtasksChanged}
                  />
                ) : null}

                {user ? (
                  <View style={styles.timerBlock}>
                    <TaskItem
                      task={task}
                      userId={user.id}
                      comparableSeconds={getComparableSessionSeconds(
                        sessions,
                        task.title ?? "",
                      )}
                      sessions={sessions}
                      onTimeCommitted={handleTimeCommitted}
                      onComplete={handleCompleteTask}
                      onSessionSaved={handleSessionSaved}
                    />
                  </View>
                ) : null}
              </View>
            ))
          )}
        </View>
      </View>
    </ScrollView>
  );
};

export default Tasks;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#050505",
  },
  contentContainer: {
    flexGrow: 1,
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 32,
  },
  panel: {
    width: "100%",
    maxWidth: 720,
  },
  title: {
    color: "#f4f4f4",
    fontSize: 30,
    fontWeight: "800",
    marginBottom: 22,
    textAlign: "center",
  },
  addTaskContainer: {
    alignItems: "center",
    borderBottomColor: "#3a3a3a",
    borderBottomWidth: 1,
    gap: 12,
    paddingBottom: 22,
  },
  input: {
    width: "100%",
    backgroundColor: "#141414",
    borderColor: "#4a4a4a",
    borderRadius: 8,
    borderWidth: 1,
    color: "#f5f5f5",
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  estimateBlock: {
    gap: 10,
    width: "100%",
  },
  estimatePrompt: {
    color: "#f4f4f4",
    fontSize: 15,
    fontWeight: "700",
  },
  estimateChoices: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    width: "100%",
  },
  estimateChip: {
    alignItems: "center",
    backgroundColor: "#181818",
    borderColor: "#4a4a4a",
    borderRadius: 7,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: 12,
  },
  selectedEstimateChip: {
    backgroundColor: "#315f30",
    borderColor: "#9ccf9b",
  },
  estimateChipText: {
    color: "#f4f4f4",
    fontSize: 14,
    fontWeight: "800",
  },
  customEstimateRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    width: "100%",
  },
  customEstimateInput: {
    backgroundColor: "#141414",
    borderColor: "#4a4a4a",
    borderRadius: 8,
    borderWidth: 1,
    color: "#f5f5f5",
    flex: 1,
    fontSize: 15,
    minHeight: 42,
    paddingHorizontal: 12,
  },
  smallButton: {
    alignItems: "center",
    backgroundColor: "#615d5d",
    borderRadius: 7,
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: 16,
  },
  smallButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#b3262f",
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 46,
    paddingHorizontal: 28,
    width: "100%",
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  errorText: {
    color: "#ff7b7b",
    marginTop: 12,
    textAlign: "center",
  },
  taskList: {
    gap: 12,
    paddingTop: 22,
  },
  statusText: {
    color: "#c9c9c9",
    fontSize: 16,
    textAlign: "center",
  },
  taskItem: {
    backgroundColor: "#101010",
    borderColor: "#3a3a3a",
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
  },
  taskMainRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  taskName: {
    color: "#f4f4f4",
    flex: 1,
    fontSize: 17,
    fontWeight: "700",
    minWidth: 150,
  },
  completedTaskName: {
    color: "#9d9d9d",
    textDecorationLine: "line-through",
  },
  taskButton: {
    alignItems: "center",
    backgroundColor: "#8f1d24",
    borderRadius: 7,
    minHeight: 38,
    minWidth: 82,
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  checkedButton: {
    backgroundColor: "#4f171b",
  },
  deleteButton: {
    backgroundColor: "#c0323b",
  },
  taskButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  taskMetaRow: {
    alignItems: "center",
    borderTopColor: "#333333",
    borderTopWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "space-between",
    marginTop: 14,
    paddingTop: 12,
  },
  timeText: {
    backgroundColor: "#e44332",
    borderRadius: 7,
    color: "#050505",
    fontSize: 14,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  timerBlock: {
    marginTop: 12,
  },
});
