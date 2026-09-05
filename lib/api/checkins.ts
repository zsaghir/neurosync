import {
  authenticatedAPIRequest,
  type GetClerkToken,
} from "./client";

export type CheckInBlocker =
  | "shame"
  | "task_initiation"
  | "time_blindness";

export type CheckInHelpfulness = "yes" | "a_little" | "not_yet";

export type CheckIn = {
  id: string;
  taskId: string | null;
  blocker: CheckInBlocker;
  reason: string | null;
  supportAction: string | null;
  nextStep: string | null;
  plannedMinutes: number | null;
  stucknessBefore: number;
  stucknessAfter: number | null;
  interventionAttempted: boolean | null;
  nextStepTaken: boolean | null;
  helpfulness: CheckInHelpfulness | null;
  followedUpAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateCheckInInput = {
  taskId?: string;
  blocker: CheckInBlocker;
  reason?: string;
  supportAction: string;
  nextStep: string;
  plannedMinutes: number;
  stucknessBefore: number;
};

export type CheckInOutcomeInput = {
  stucknessAfter: number;
  interventionAttempted: boolean;
  nextStepTaken?: boolean;
  helpfulness: CheckInHelpfulness;
};

export const createCheckIn = (
  getToken: GetClerkToken,
  input: CreateCheckInInput,
) =>
  authenticatedAPIRequest<CheckIn>("/v1/check-ins", getToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

export const recordCheckInOutcome = (
  getToken: GetClerkToken,
  checkInId: string,
  input: CheckInOutcomeInput,
) =>
  authenticatedAPIRequest<CheckIn>(
    `/v1/check-ins/${encodeURIComponent(checkInId)}/outcome`,
    getToken,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
