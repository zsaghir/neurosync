import { defineQuery } from "groq";
import { sanityClient } from "./client";

export interface TaskInput {
  title: string;
  userId: string;
  completed?: boolean;
  timeSpentSeconds?: number;
  subtasks?: Array<{
    _key?: string;
    title: string;
    completed?: boolean;
  }>;
  alarmAt?: string | null;
  createdAt?: string;
  completedAt?: string | null;
  estimatedMinutes?: number | null;
  notes?: string | null;
}

export interface TaskDocument {
  _id: string;
  title?: string;
  completed?: boolean;
  timeSpentSeconds?: number;
  subtasks?: TaskInput["subtasks"];
  alarmAt?: string | null;
  createdAt?: string;
  completedAt?: string | null;
  estimatedMinutes?: number | null;
  notes?: string | null;
  userId?: string;
}

export const TASKS_QUERY = defineQuery(`*[
	_type == "task"
	&& userId == $userId
] | order(createdAt desc) {
	_id,
	title,
	completed,
	timeSpentSeconds,
	subtasks,
	alarmAt,
	createdAt,
	completedAt,
	estimatedMinutes,
	notes,
	userId
}`);

export const TASK_BY_ID_QUERY = defineQuery(`*[
    _type == "task"
    && _id == $taskId
  ][0] {
    _id,
    title,
    completed,
    timeSpentSeconds,
    subtasks,
    alarmAt,
    createdAt,
    completedAt,
    estimatedMinutes,
    notes,
    userId
  }`);

//fetch tasks for a specific user
export const fetchTasks = async (userId: string): Promise<TaskDocument[]> => {
  try {
    const tasks = await sanityClient.fetch(TASKS_QUERY, { userId });
    return tasks;
  } catch (error) {
    console.error("Error fetching tasks:", error);
    throw error;
  }
};
//fetch a single task by its ID
export const fetchTaskById = async (taskId: string): Promise<TaskDocument> => {
  try {
    const task = await sanityClient.fetch(TASK_BY_ID_QUERY, { taskId });
    return task;
  } catch (error) {
    console.error("Error fetching task by ID:", error);
    throw error;
  }
};

// Create a new task
export const createTask = async (input: TaskInput): Promise<TaskDocument> => {
  try {
    const task = {
      _type: "task" as const,
      title: input.title,
      completed: input.completed ?? false,
      timeSpentSeconds: input.timeSpentSeconds ?? 0,
      subtasks: input.subtasks ?? [],
      alarmAt: input.alarmAt ?? null,
      completedAt: input.completedAt ?? null,
      estimatedMinutes: input.estimatedMinutes ?? null,
      notes: input.notes ?? null,
      userId: input.userId,
      createdAt: input.createdAt ?? new Date().toISOString(),
    };

    const result = await sanityClient.create(task);
    return result;
  } catch (error) {
    console.error("Error creating task:", error);
    throw error;
  }
};
// Toggle task completion status
export const toggleTaskComplete = async (
  taskId: string,
  completed: boolean,
): Promise<TaskDocument> => {
  try {
    const result = await sanityClient
      .patch(taskId)
      .set({
        completed,
        completedAt: completed ? new Date().toISOString() : null,
      })
      .commit();
    return result;
  } catch (error) {
    console.error("Error toggling task completion:", error);
    throw error;
  }
};

export const setTaskEstimate = async (
  taskId: string,
  estimatedMinutes: number | null,
): Promise<TaskDocument> => {
  try {
    const result = await sanityClient
      .patch(taskId)
      .set({ estimatedMinutes })
      .commit();
    return result;
  } catch (error) {
    console.error("Error setting task estimate:", error);
    throw error;
  }
};
export const setTaskNotes = async (
  taskId: string,
  notes: string | null,
): Promise<TaskDocument> => {
  try {
    const result = await sanityClient
      .patch(taskId)
      .set({ notes })
      .commit();
    return result;
  } catch (error) {
    console.error("Error setting task notes:", error);
    throw error;
  }
};
// creat a new subtask for a task
export const addSubtask = async (
  taskId: string,
  subtaskTitle: string,
): Promise<TaskDocument> => {
  try {
    const result = await sanityClient
      .patch(taskId)
      .append("subtasks", [{ title: subtaskTitle, completed: false }])
      .commit();
    return result;
  } catch (error) {
    console.error("Error adding subtask:", error);
    throw error;
  }
};

export const setTaskSubtasks = async (
  taskId: string,
  subtasks: NonNullable<TaskInput["subtasks"]>,
): Promise<TaskDocument> => {
  try {
    const result = await sanityClient.patch(taskId).set({ subtasks }).commit();
    return result;
  } catch (error) {
    console.error("Error setting subtasks:", error);
    throw error;
  }
};
// Toggle subtask completion status
export const toggleSubtaskComplete = async (
  taskId: string,
  completed: boolean,
  subtaskKey: string,
): Promise<TaskDocument> => {
  try {
    const result = await sanityClient
      .patch(taskId)
      .set({ [`subtasks[_key == "${subtaskKey}"].completed`]: completed })
      .commit();
    return result;
  } catch (error) {
    console.error("Error toggling subtask completion:", error);
    throw error;
  }
};

// Add time to a task
export const addTimeToTask = async (
  taskId: string,
  secondsToAdd: number,
): Promise<TaskDocument> => {
  try {
    const result = await sanityClient
      .patch(taskId)
      .inc({ timeSpentSeconds: secondsToAdd })
      .commit();
    return result;
  } catch (error) {
    console.error("Error updating task time:", error);
    throw error;
  }
};
// Delete a task
export const deleteTask = async (taskId: string): Promise<void> => {
  try {
    const result = await sanityClient.delete(taskId);
  } catch (error) {
    console.error("Error deleting task:", error);
    throw error;
  }
};
// set an alarm for a task
export const setTaskAlarm = async (
  taskId: string,
  alarmAt: string,
  notificationId: string,
): Promise<TaskDocument> => {
  try {
    const result = await sanityClient
      .patch(taskId)
      .set({ alarmAt, notificationId })
      .commit();
    return result;
  } catch (error) {
    console.error("Error setting task alarm:", error);
    throw error;
  }
};
