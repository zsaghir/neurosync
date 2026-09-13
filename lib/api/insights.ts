import type { CheckInBlocker } from "./checkins";
import {
  authenticatedAPIRequest,
  type GetClerkToken,
} from "./client";

export type CheckInInsightPattern = {
  blocker: CheckInBlocker;
  supportAction: string;
  createdCheckIns: number;
  completedFollowUps: number;
  attemptedCount: number;
  nextStepTakenCount: number;
  successRate: number | null;
  averageStucknessImprovement: number | null;
  insufficientData: boolean;
};

export type CheckInInsights = {
  totalCheckIns: number;
  completedFollowUps: number;
  followUpRate: number | null;
  patterns: CheckInInsightPattern[];
};

export const fetchCheckInInsights = (getToken: GetClerkToken) =>
  authenticatedAPIRequest<CheckInInsights>("/v1/check-in-insights", getToken);
