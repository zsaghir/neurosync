import {
  authenticatedAPIRequest,
  type GetClerkToken,
} from "./client";

export type TaskSubtask = {
  _key?: string;
  title: string;
  completed?: boolean;
};

export type TaskDocument = {
  _id: string;
  title: string;
  completed: boolean;
  timeSpentSeconds: number;
  estimatedMinutes: number | null;
  notes: string | null;
  alarmAt: string | null;
  notificationId: string | null;
  completedAt: string | null;
  createdAt: string;
  // Subtasks stay unavailable until the authenticated Subtasks API is switched.
  subtasks?: TaskSubtask[];
};

type TaskAPIResponse = Omit<TaskDocument, "_id" | "subtasks"> & {
  id: string;
};

type TaskListAPIResponse = {
  tasks: TaskAPIResponse[];
};

export type TaskCreateInput = {
  title: string;
  estimatedMinutes?: number | null;
  notes?: string | null;
  alarmAt?: string | null;
  notificationId?: string | null;
};

export type TaskUpdateInput = Partial<{
  title: string;
  completed: boolean;
  estimatedMinutes: number | null;
  notes: string | null;
  alarmAt: string | null;
  notificationId: string | null;
  timeSpentSecondsDelta: number;
}>;

const normalizeTask = ({ id, ...task }: TaskAPIResponse): TaskDocument => ({
  _id: id,
  ...task,
});

export const fetchTasks = async (
  getToken: GetClerkToken,
): Promise<TaskDocument[]> => {
  const response = await authenticatedAPIRequest<TaskListAPIResponse>(
    "/v1/tasks",
    getToken,
  );
  return response.tasks.map(normalizeTask);
};

export const fetchTaskById = async (
  getToken: GetClerkToken,
  taskId: string,
): Promise<TaskDocument> => {
  const task = await authenticatedAPIRequest<TaskAPIResponse>(
    `/v1/tasks/${encodeURIComponent(taskId)}`,
    getToken,
  );
  return normalizeTask(task);
};

export const createTask = async (
  getToken: GetClerkToken,
  input: TaskCreateInput,
): Promise<TaskDocument> => {
  const task = await authenticatedAPIRequest<TaskAPIResponse>(
    "/v1/tasks",
    getToken,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  return normalizeTask(task);
};

export const updateTask = async (
  getToken: GetClerkToken,
  taskId: string,
  input: TaskUpdateInput,
): Promise<TaskDocument> => {
  const task = await authenticatedAPIRequest<TaskAPIResponse>(
    `/v1/tasks/${encodeURIComponent(taskId)}`,
    getToken,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  return normalizeTask(task);
};

export const toggleTaskComplete = (
  getToken: GetClerkToken,
  taskId: string,
  completed: boolean,
) => updateTask(getToken, taskId, { completed });

export const setTaskEstimate = (
  getToken: GetClerkToken,
  taskId: string,
  estimatedMinutes: number | null,
) => updateTask(getToken, taskId, { estimatedMinutes });

export const setTaskNotes = (
  getToken: GetClerkToken,
  taskId: string,
  notes: string | null,
) => updateTask(getToken, taskId, { notes });

export const addTimeToTask = (
  getToken: GetClerkToken,
  taskId: string,
  secondsToAdd: number,
) => updateTask(getToken, taskId, {
  timeSpentSecondsDelta: Math.round(secondsToAdd),
});

export const setTaskAlarm = (
  getToken: GetClerkToken,
  taskId: string,
  alarmAt: string | null,
  notificationId: string | null,
) => updateTask(getToken, taskId, { alarmAt, notificationId });

export const deleteTask = async (
  getToken: GetClerkToken,
  taskId: string,
): Promise<void> => {
  await authenticatedAPIRequest<void>(
    `/v1/tasks/${encodeURIComponent(taskId)}`,
    getToken,
    { method: "DELETE" },
  );
};
