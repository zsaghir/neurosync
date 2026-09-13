import type {
  CheckInInsightPattern,
  CheckInInsights,
} from "@/lib/api/insights";
import type { CheckInBlocker } from "@/lib/api/checkins";

export type InsightsViewState = "loading" | "error" | "empty" | "populated";

export const getInsightsViewState = (
  isLoading: boolean,
  error: string,
  insights: CheckInInsights | null,
): InsightsViewState => {
  if (isLoading) return "loading";
  if (error) return "error";
  if (!insights || insights.totalCheckIns === 0) return "empty";
  return "populated";
};

export const formatPercentage = (rate: number | null) =>
  rate == null ? "—" : `${Math.round(rate * 100)}%`;

export const formatSupportAction = (supportAction: string) => {
  const words = supportAction.replaceAll("_", " ").trim();
  return words ? words[0].toUpperCase() + words.slice(1) : "Unnamed strategy";
};

export const blockerLabel = (blocker: CheckInBlocker) => {
  const labels: Record<CheckInBlocker, string> = {
    shame: "Shame and self-criticism",
    task_initiation: "Starting tasks",
    time_blindness: "Time awareness",
  };
  return labels[blocker];
};

export const attemptsUntilComparison = (attemptedCount: number) =>
  Math.max(0, 5 - attemptedCount);

export const describeInsufficientData = (attemptedCount: number) => {
  const attemptsNeeded = attemptsUntilComparison(attemptedCount);
  return `Try this strategy ${attemptsNeeded} more ${attemptsNeeded === 1 ? "time" : "times"} before NeuroSync compares its pattern.`;
};

const formatPoints = (value: number) => {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
};

export const describeStucknessChange = (pattern: CheckInInsightPattern) => {
  const improvement = pattern.averageStucknessImprovement;
  const count = pattern.completedFollowUps;
  const followUps = `${count} follow-up${count === 1 ? "" : "s"}`;

  if (improvement == null || count === 0) {
    return "No completed follow-up is available for stuckness yet.";
  }
  if (improvement > 0) {
    return `Stuckness decreased by ${formatPoints(improvement)} points on average across ${followUps}.`;
  }
  if (improvement < 0) {
    return `Stuckness increased by ${formatPoints(Math.abs(improvement))} points on average across ${followUps}.`;
  }
  return `Stuckness did not change on average across ${followUps}.`;
};

export type InsightGroup = {
  blocker: CheckInBlocker;
  patterns: CheckInInsightPattern[];
};

export const groupInsightPatterns = (patterns: CheckInInsightPattern[]) => {
  const groups = new Map<CheckInBlocker, CheckInInsightPattern[]>();
  for (const pattern of patterns) {
    const group = groups.get(pattern.blocker) ?? [];
    group.push(pattern);
    groups.set(pattern.blocker, group);
  }
  return Array.from(groups, ([blocker, groupedPatterns]): InsightGroup => ({
    blocker,
    patterns: groupedPatterns,
  }));
};

export const insightAccessibilityLabel = (pattern: CheckInInsightPattern) => {
  const success = pattern.successRate == null
    ? "No attempted interventions yet."
    : `${formatPercentage(pattern.successRate)} next-step rate: ${pattern.nextStepTakenCount} of ${pattern.attemptedCount} attempts.`;
  return `${formatSupportAction(pattern.supportAction)}. ${success} ${describeStucknessChange(pattern)}`;
};
