import { defineQuery } from "groq";
import {
  type ActualSecondsSource,
  type EstimateInputType,
  createTaskTitleSignature,
  getPersonalDefaultMinutes,
} from "@/lib/utils/time-wisdom";
import { sanityClient } from "./client";

export type TaskSessionInput = {
  taskId: string;
  userId: string;
  taskTitle: string;
  estimatedMinutes?: number | null;
  estimateInputType: EstimateInputType;
  timerMeasuredSeconds: number;
  actualSeconds: number;
  actualSecondsSource: ActualSecondsSource;
  startedAt?: string | null;
  endedAt?: string;
  excludedFromInsights?: boolean;
  excludeReason?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type TaskSessionDocument = TaskSessionInput & {
  _id: string;
  _createdAt?: string;
  taskTitleSignature: string;
  endedAt: string;
  excludedFromInsights: boolean;
  createdAt: string;
  updatedAt: string;
};

export const TASK_SESSIONS_QUERY = defineQuery(`*[
  _type == "taskSession"
  && userId == $userId
] | order(endedAt desc) {
  _id,
  taskId,
  userId,
  taskTitle,
  taskTitleSignature,
  estimatedMinutes,
  estimateInputType,
  timerMeasuredSeconds,
  actualSeconds,
  actualSecondsSource,
  startedAt,
  endedAt,
  excludedFromInsights,
  excludeReason,
  createdAt,
  updatedAt
}`);

export const createTaskSession = async (
  input: TaskSessionInput,
): Promise<TaskSessionDocument> => {
  const now = new Date().toISOString();
  const taskSession = {
    _type: "taskSession" as const,
    ...input,
    taskTitleSignature: createTaskTitleSignature(input.taskTitle),
    estimatedMinutes: input.estimatedMinutes ?? null,
    startedAt: input.startedAt ?? null,
    endedAt: input.endedAt ?? now,
    excludedFromInsights: input.excludedFromInsights ?? false,
    excludeReason: input.excludeReason ?? null,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
  };

  try {
    const result = await sanityClient.create(taskSession);
    return result;
  } catch (error) {
    console.error("Error creating task session:", error);
    throw error;
  }
};

export const fetchTaskSessions = async (
  userId: string,
): Promise<TaskSessionDocument[]> => {
  try {
    return await sanityClient.fetch(TASK_SESSIONS_QUERY, { userId });
  } catch (error) {
    console.error("Error fetching task sessions:", error);
    throw error;
  }
};

export const updateTaskSessionActualTime = async (
  sessionId: string,
  actualSeconds: number,
  actualSecondsSource: ActualSecondsSource = "userEdited",
): Promise<TaskSessionDocument> => {
  try {
    return await sanityClient
      .patch(sessionId)
      .set({
        actualSeconds,
        actualSecondsSource,
        updatedAt: new Date().toISOString(),
      })
      .commit();
  } catch (error) {
    console.error("Error updating task session time:", error);
    throw error;
  }
};

export const updateTaskSessionExclusion = async (
  sessionId: string,
  excludedFromInsights: boolean,
  excludeReason?: string | null,
): Promise<TaskSessionDocument> => {
  try {
    return await sanityClient
      .patch(sessionId)
      .set({
        excludedFromInsights,
        excludeReason: excludedFromInsights ? (excludeReason ?? "weird") : null,
        updatedAt: new Date().toISOString(),
      })
      .commit();
  } catch (error) {
    console.error("Error updating task session exclusion:", error);
    throw error;
  }
};

export const getComparableSessionSeconds = (
  sessions: TaskSessionDocument[],
  taskTitle: string,
) => {
  const signature = createTaskTitleSignature(taskTitle);

  return sessions
    .filter(
      (session) =>
        !session.excludedFromInsights &&
        session.taskTitleSignature === signature &&
        session.actualSeconds >= 60,
    )
    .map((session) => session.actualSeconds);
};

export const getPersonalDefaultForTask = (
  sessions: TaskSessionDocument[],
  taskTitle: string,
) => {
  return getPersonalDefaultMinutes(getComparableSessionSeconds(sessions, taskTitle));
};
