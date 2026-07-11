export type EstimateInputType = "bucket" | "preset" | "custom" | "skipped";

export type ActualSecondsSource = "timer" | "userEdited" | "manual";

export type TimeEstimationMode = "relative" | "minutes" | "custom";

export type BucketEstimate = "quick" | "medium" | "long";

export type ThemeMode = "dark" | "light";

export type UserTimeSettings = {
  preferredTimeEstimationMode: TimeEstimationMode;
  themeMode: ThemeMode;
};

export type EstimateChoice = {
  label: string;
  minutes: number | null;
  inputType: EstimateInputType;
};

export const RELATIVE_ESTIMATE_CHOICES: EstimateChoice[] = [
  { label: "Quick", minutes: 10, inputType: "bucket" },
  { label: "Medium", minutes: 30, inputType: "bucket" },
  { label: "Long", minutes: 60, inputType: "bucket" },
  { label: "Skip estimation", minutes: null, inputType: "skipped" },
];

export const MINUTE_ESTIMATE_CHOICES: EstimateChoice[] = [
  { label: "15 min", minutes: 15, inputType: "preset" },
  { label: "30 min", minutes: 30, inputType: "preset" },
  { label: "60 min", minutes: 60, inputType: "preset" },
  { label: "Skip estimation", minutes: null, inputType: "skipped" },
];

export const ESTIMATE_CHOICES: EstimateChoice[] = [
  ...RELATIVE_ESTIMATE_CHOICES.slice(0, 3),
  ...MINUTE_ESTIMATE_CHOICES,
];

export const DEFAULT_USER_TIME_SETTINGS: UserTimeSettings = {
  preferredTimeEstimationMode: "relative",
  themeMode: "dark",
};

export const BUCKET_ESTIMATE_MINUTES: Record<BucketEstimate, number> = {
  quick: 10,
  medium: 30,
  long: 60,
};

export const getEstimateChoicesForMode = (
  mode: TimeEstimationMode,
): EstimateChoice[] => {
  if (mode === "relative") return RELATIVE_ESTIMATE_CHOICES;
  if (mode === "minutes") return MINUTE_ESTIMATE_CHOICES;

  return [{ label: "Skip estimation", minutes: null, inputType: "skipped" }];
};

export const getTimeEstimationModeLabel = (mode: TimeEstimationMode) => {
  if (mode === "relative") {
    return "Quick / Medium / Long";
  }

  if (mode === "minutes") return "Minute presets";

  return "Custom time entry";
};

const fillerWords = new Set(["the", "a", "an", "my"]);

export const createTaskTitleSignature = (title = "") => {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word && !fillerWords.has(word))
    .join(" ")
    .trim();
};

export const shouldPromptForLongSession = (
  actualSeconds: number,
  estimatedMinutes?: number | null,
) => {
  if (actualSeconds >= 2 * 60 * 60) return true;
  if (!estimatedMinutes) return false;

  return actualSeconds > estimatedMinutes * 60 * 3;
};

export const shouldPromptForShortSession = (actualSeconds: number) => {
  return actualSeconds > 0 && actualSeconds < 60;
};

export const isCleanCountedSession = ({
  actualSeconds,
  estimatedMinutes,
  excludedFromInsights,
  actualSecondsSource,
}: {
  actualSeconds: number;
  estimatedMinutes?: number | null;
  excludedFromInsights?: boolean;
  actualSecondsSource: ActualSecondsSource;
}) => {
  return (
    !excludedFromInsights &&
    actualSecondsSource === "timer" &&
    actualSeconds >= 60 &&
    !shouldPromptForLongSession(actualSeconds, estimatedMinutes)
  );
};

export const shouldShowDoneReflection = ({
  cleanCountedSessionsToday,
  cleanCountedSessionsTotal,
}: {
  cleanCountedSessionsToday: number;
  cleanCountedSessionsTotal: number;
}) => {
  if (cleanCountedSessionsToday > 0) return false;

  return cleanCountedSessionsTotal % 3 === 0;
};

export const median = (values: number[]) => {
  if (values.length === 0) return null;

  const sortedValues = [...values].sort((a, b) => a - b);
  const middleIndex = Math.floor(sortedValues.length / 2);

  if (sortedValues.length % 2 === 1) {
    return sortedValues[middleIndex];
  }

  return (sortedValues[middleIndex - 1] + sortedValues[middleIndex]) / 2;
};

export const formatDurationLabel = (seconds = 0) => {
  const roundedSeconds = Math.max(0, Math.round(seconds));
  const hours = Math.floor(roundedSeconds / 3600);
  const minutes = Math.floor((roundedSeconds % 3600) / 60);
  const remainingSeconds = roundedSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m`;
  }

  return `${remainingSeconds}s`;
};

export const getPersonalDefaultMinutes = (actualSeconds: number[]) => {
  if (actualSeconds.length < 3) return null;

  const medianSeconds = median(actualSeconds);
  if (medianSeconds == null) return null;

  return Math.max(1, Math.round(medianSeconds / 60));
};
