import type {
  ActualSecondsSource,
  EstimateInputType,
} from "@/lib/utils/time-wisdom";
import {
  authenticatedAPIRequest,
  type GetClerkToken,
} from "./client";

export type TaskSessionDocument = {
  _id: string;
  taskId: string | null;
  taskTitle: string;
  taskTitleSignature: string;
  estimatedMinutes: number | null;
  estimateInputType: EstimateInputType;
  timerMeasuredSeconds: number;
  actualSeconds: number;
  actualSecondsSource: ActualSecondsSource;
  startedAt: string | null;
  endedAt: string;
  excludedFromInsights: boolean;
  excludeReason: string | null;
  createdAt: string;
  updatedAt: string;
};

type TaskSessionAPIResponse = Omit<TaskSessionDocument, "_id"> & {
  id: string;
};

type TaskSessionListAPIResponse = {
  sessions: TaskSessionAPIResponse[];
};

export type TaskSessionCreateInput = {
  taskId: string;
  estimatedMinutes?: number | null;
  estimateInputType: EstimateInputType;
  timerMeasuredSeconds: number;
  actualSeconds: number;
  actualSecondsSource: ActualSecondsSource;
  startedAt?: string | null;
  endedAt: string;
  excludedFromInsights?: boolean;
  excludeReason?: string | null;
};

const normalizeSession = ({
  id,
  ...session
}: TaskSessionAPIResponse): TaskSessionDocument => ({
  _id: id,
  ...session,
});

export const fetchTaskSessions = async (
  getToken: GetClerkToken,
): Promise<TaskSessionDocument[]> => {
  const response = await authenticatedAPIRequest<TaskSessionListAPIResponse>(
    "/v1/task-sessions",
    getToken,
  );
  return response.sessions.map(normalizeSession);
};

export const createTaskSession = async (
  getToken: GetClerkToken,
  input: TaskSessionCreateInput,
): Promise<TaskSessionDocument> => {
  const response = await authenticatedAPIRequest<TaskSessionAPIResponse>(
    "/v1/task-sessions",
    getToken,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  return normalizeSession(response);
};
