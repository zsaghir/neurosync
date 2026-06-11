//now we need the timer functionality inside the task screen, we will create a button for
// every task which says start working. that button will enable the timer for that specific
// task and show the elapsed time on the task item. we will also add a pause button to pause
// the timer and a reset button to reset the timer for that task. we will use the same useTimer
//  hook for this functionality but we will need to modify it to accept a taskId so that we can
// track the time for each task separately. We will also need  a done button in timer so when a
// person has completed a task they press done and the timer stops and resets for that task. we
// will also need to store the time spent on each task in sanity so that we can show the total
// time spent on each task in the task list.
import TaskItem from "@/components/TaskItem";
import {
  createTask,
  deleteTask,
  fetchTasks,
  toggleTaskComplete,
  type TaskDocument,
  type TaskInput,
} from "@/lib/sanity/tasks";
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
  const [title, setTitle] = useState("");
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

      const userTasks = await fetchTasks(user.id);
      setTasks(userTasks);
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
    //implementing adding task functionality
    if (user) {
      if (!title.trim()) {
        setTitleError("Please enter a task title.");
        return;
      }
      setTitleError("");
      const newTaskInput: TaskInput = {
        title: title.trim(),
        userId: user.id,
      };

      const createdTask = await createTask(newTaskInput);
      setTasks((currentTasks) => [createdTask, ...currentTasks]);
      setTitle("");
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

  const toggleSubtasks = (taskId: string) => {
    setVisibleSubtasks((current) => ({
      ...current,
      [taskId]: !current[taskId],
    }));
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

                <View style={styles.taskMetaRow}>
                  {task.completed ? (
                    <Text style={styles.timeText}>
                      Time taken to complete:{" "}
                      {formatTime(task.timeSpentSeconds)}
                    </Text>
                  ) : null}

                  <Pressable
                    style={styles.subtaskToggle}
                    onPress={() => toggleSubtasks(task._id)}
                  >
                    <Text style={styles.subtaskToggleText}>
                      {visibleSubtasks[task._id]
                        ? "Hide subtasks"
                        : "View subtasks"}
                    </Text>
                  </Pressable>
                </View>
                <View style={styles.timerBlock}>
                  <TaskItem
                    taskId={task._id}
                    onTimeCommitted={handleTimeCommitted}
                    onComplete={handleCompleteTask}
                  />
                </View>

                {visibleSubtasks[task._id] ? (
                  <View style={styles.subtasksContainer}>
                    <Text style={styles.emptySubtasksText}>
                      No subtasks yet.
                    </Text>
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
  subtaskToggle: {
    borderColor: "#7f272d",
    borderRadius: 7,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  subtaskToggleText: {
    color: "#ffb3b8",
    fontSize: 14,
    fontWeight: "700",
  },
  subtasksContainer: {
    borderTopColor: "#333333",
    borderTopWidth: 1,
    marginTop: 12,
    paddingTop: 12,
  },
  emptySubtasksText: {
    color: "#8f8f8f",
    fontSize: 14,
  },
});
