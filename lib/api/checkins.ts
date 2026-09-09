import {
  authenticatedAPIRequest,
  type GetClerkToken,
} from "./client";

export type CheckInBlocker =
  | "shame"
  | "task_initiation"
  | "time_blindness";

export type CheckInHelpfulness = "yes" | "a_little" | "not_yet";

export type CheckInCapacity =
  | "about_normal"
  | "lower_than_usual"
  | "almost_nothing_left"
  | "not_sure";

export type CheckInSleep =
  | "restful"
  | "too_short"
  | "restless"
  | "prefer_not_to_say";

export type CheckInBasicNeeds = "yes" | "not_really" | "prefer_not_to_say";

export type CheckInDifficulty =
  | "task_too_large"
  | "first_step_unclear"
  | "shame"
  | "distracted"
  | "time_unclear"
  | "too_many_choices"
  | "low_energy"
  | "emotionally_overwhelmed";

export type CheckInStrategy =
  | "externalize"
  | "tiny_step"
  | "short_sprint"
  | "make_visible"
  | "reduce_choices"
  | "body_double"
  | "immediate_reward"
  | "basic_needs_check"
  | "reduce_distractions"
  | "gentle_restart";

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

export type CheckInSuggestionInput = {
  taskId?: string;
  blocker: CheckInBlocker;
  brainDump: string;
  capacity?: CheckInCapacity;
  sleep?: CheckInSleep;
  basicNeeds?: CheckInBasicNeeds;
  medicationShift?: boolean;
  substanceImpact?: boolean;
  difficulties: CheckInDifficulty[];
};

export type CheckInSuggestion = {
  strategy: CheckInStrategy;
  title: string;
  nextStep: string;
  plannedMinutes: number;
  why: string;
};

export type CheckInSuggestionResponse = {
  reassurance: string;
  observation: string;
  suggestions: CheckInSuggestion[];
  medicalNote: string | null;
};

export const requestCheckInSuggestions = (
  getToken: GetClerkToken,
  input: CheckInSuggestionInput,
) =>
  authenticatedAPIRequest<CheckInSuggestionResponse>(
    "/v1/check-in-suggestions",
    getToken,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );

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
