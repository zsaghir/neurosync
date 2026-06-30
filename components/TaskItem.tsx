import { useTimer } from "@/hooks/use-timer";
import {
  addTimeToTask,
  type TaskDocument,
} from "@/lib/sanity/tasks";
import {
  createTaskSession,
  type TaskSessionDocument,
} from "@/lib/sanity/taskSessions";
import formattime from "@/lib/utils/formattime";
import {
  ESTIMATE_CHOICES,
  type ActualSecondsSource,
  type EstimateInputType,
  formatDurationLabel,
  getPersonalDefaultMinutes,
  isCleanCountedSession,
  shouldPromptForLongSession,
  shouldPromptForShortSession,
  shouldShowDoneReflection,
} from "@/lib/utils/time-wisdom";
import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

type TaskItemProps = {
  task: TaskDocument;
  userId: string;
  comparableSeconds: number[];
  sessions: TaskSessionDocument[];
  onTimeCommitted?: (taskId: string, seconds: number) => void;
  onComplete?: (taskId: string) => void;
  onSessionSaved?: (session: TaskSessionDocument) => void;
};

type ReviewReason = "adjust" | "long" | "short" | "manual";

type ReviewState = {
  reason: ReviewReason;
  timerSeconds: number;
  actualSecondsSource: ActualSecondsSource;
  title: string;
  description: string;
};

const parseMinutes = (value: string) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;

  return Math.round(parsed);
};

const TaskItem = ({
  task,
  userId,
  comparableSeconds,
  sessions,
  onTimeCommitted,
  onComplete,
  onSessionSaved,
}: TaskItemProps) => {
  const { elapsedSeconds, accumulatedSeconds, isRunning, startedAt, start, pause, reset } =
    useTimer(task._id);
  const [estimatedMinutes, setEstimatedMinutes] = useState<number | null>(
    task.estimatedMinutes ?? null,
  );
  const [estimateInputType, setEstimateInputType] =
    useState<EstimateInputType>(
      task.estimatedMinutes == null ? "skipped" : "custom",
    );
  const [isEstimateLocked, setIsEstimateLocked] = useState(false);
  const [customEstimate, setCustomEstimate] = useState("");
  const [reviewState, setReviewState] = useState<ReviewState | null>(null);
  const [actualMinutesInput, setActualMinutesInput] = useState("");
  const [feedback, setFeedback] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const personalDefaultMinutes = useMemo(
    () => getPersonalDefaultMinutes(comparableSeconds),
    [comparableSeconds],
  );

  const cleanCountedSessionsToday = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);

    return sessions.filter((session) => {
      if (session.endedAt?.slice(0, 10) !== today) return false;

      return isCleanCountedSession({
        actualSeconds: session.actualSeconds,
        estimatedMinutes: session.estimatedMinutes,
        excludedFromInsights: session.excludedFromInsights,
        actualSecondsSource: session.actualSecondsSource,
      });
    }).length;
  }, [sessions]);

  const cleanCountedSessionsTotal = useMemo(() => {
    return sessions.filter((session) =>
      isCleanCountedSession({
        actualSeconds: session.actualSeconds,
        estimatedMinutes: session.estimatedMinutes,
        excludedFromInsights: session.excludedFromInsights,
        actualSecondsSource: session.actualSecondsSource,
      }),
    ).length;
  }, [sessions]);

  const handleEstimateChoice = (
    minutes: number | null,
    inputType: EstimateInputType,
  ) => {
    if (isEstimateLocked) return;

    setEstimatedMinutes(minutes);
    setEstimateInputType(inputType);
  };

  const handleCustomEstimate = () => {
    if (isEstimateLocked) return;

    const minutes = parseMinutes(customEstimate);
    setEstimatedMinutes(minutes > 0 ? minutes : null);
    setEstimateInputType(minutes > 0 ? "custom" : "skipped");
    setCustomEstimate("");
  };

  const handleStart = () => {
    setIsEstimateLocked(true);
    setFeedback("");
    start();
  };

  const handlePause = async () => {
    await pause();
  };

  const saveSession = async ({
    timerSeconds,
    actualSeconds,
    actualSecondsSource,
    excludedFromInsights = false,
    excludeReason = null,
  }: {
    timerSeconds: number;
    actualSeconds: number;
    actualSecondsSource: ActualSecondsSource;
    excludedFromInsights?: boolean;
    excludeReason?: string | null;
  }) => {
    if (isSaving) return;

    setIsSaving(true);
    try {
      const endedAt = new Date().toISOString();
      const session = await createTaskSession({
        taskId: task._id,
        userId,
        taskTitle: task.title ?? "Untitled task",
        estimatedMinutes,
        estimateInputType,
        timerMeasuredSeconds: Math.round(timerSeconds),
        actualSeconds: Math.round(actualSeconds),
        actualSecondsSource,
        startedAt,
        endedAt,
        excludedFromInsights,
        excludeReason,
      });

      if (!excludedFromInsights && actualSeconds > 0) {
        await addTimeToTask(task._id, Math.round(actualSeconds));
        onTimeCommitted?.(task._id, actualSeconds);
      }

      onSessionSaved?.(session);
      onComplete?.(task._id);
      reset();
      setReviewState(null);
      setActualMinutesInput("");

      const shouldReflect = isCleanCountedSession({
        actualSeconds,
        estimatedMinutes,
        excludedFromInsights,
        actualSecondsSource,
      }) &&
        estimatedMinutes != null &&
        shouldShowDoneReflection({
          cleanCountedSessionsToday,
          cleanCountedSessionsTotal: cleanCountedSessionsTotal + 1,
        });

      setFeedback(
        shouldReflect
          ? `Felt like ${estimatedMinutes} min, ran ${formatDurationLabel(
              actualSeconds,
            )}. Your map learned a little more from this one.`
          : "Saved. Your map is learning.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDone = async () => {
    const timerSeconds = Math.round(
      isRunning ? (await pause()) ?? elapsedSeconds : elapsedSeconds,
    );

    if (shouldPromptForLongSession(timerSeconds, estimatedMinutes)) {
      setActualMinutesInput(String(Math.max(1, Math.round(timerSeconds / 60))));
      setReviewState({
        reason: "long",
        timerSeconds,
        actualSecondsSource: "timer",
        title: "Looks like this timer ran a long time",
        description:
          "Still working, or did it keep going after you stopped? Either's fine.",
      });
      return;
    }

    if (shouldPromptForShortSession(timerSeconds)) {
      setActualMinutesInput("1");
      setReviewState({
        reason: "short",
        timerSeconds,
        actualSecondsSource: "timer",
        title: "That was a tiny session",
        description: "Want to save it, adjust it, or leave it out?",
      });
      return;
    }

    await saveSession({
      timerSeconds,
      actualSeconds: timerSeconds,
      actualSecondsSource: "timer",
    });
  };

  const openAdjustTime = () => {
    const timerSeconds = Math.round(elapsedSeconds || accumulatedSeconds);
    setActualMinutesInput(
      timerSeconds > 0 ? String(Math.max(1, Math.round(timerSeconds / 60))) : "",
    );
    setReviewState({
      reason: "adjust",
      timerSeconds,
      actualSecondsSource: "userEdited",
      title: "Want to adjust this?",
      description: "The timer is evidence, not the judge.",
    });
  };

  const openManualTime = () => {
    setActualMinutesInput("");
    setReviewState({
      reason: "manual",
      timerSeconds: 0,
      actualSecondsSource: "manual",
      title: "No timer needed",
      description: "What should we count for this?",
    });
  };

  const saveReviewedTime = async () => {
    if (!reviewState) return;

    const actualSeconds = parseMinutes(actualMinutesInput) * 60;
    await saveSession({
      timerSeconds: reviewState.timerSeconds,
      actualSeconds,
      actualSecondsSource:
        reviewState.reason === "manual" ? "manual" : "userEdited",
    });
  };

  const saveFullReviewedTime = async () => {
    if (!reviewState) return;

    await saveSession({
      timerSeconds: reviewState.timerSeconds,
      actualSeconds: reviewState.timerSeconds,
      actualSecondsSource: "timer",
    });
  };

  const excludeReviewedTime = async () => {
    if (!reviewState) return;

    await saveSession({
      timerSeconds: reviewState.timerSeconds,
      actualSeconds: parseMinutes(actualMinutesInput) * 60,
      actualSecondsSource: reviewState.actualSecondsSource,
      excludedFromInsights: true,
      excludeReason: reviewState.reason,
    });
  };

  return (
    <View style={styles.timerContainer}>
      <View style={styles.timerHeader}>
        <Text style={styles.timerLabel}>Focus timer</Text>
        <Text style={styles.timerStatus}>
          {isRunning ? "Running" : "Paused"}
        </Text>
      </View>

      <Text style={styles.elapsedTime}>{formattime(elapsedSeconds)}</Text>

      {!isEstimateLocked ? (
        <View style={styles.estimateBlock}>
          <Text style={styles.helperText}>How long does this feel like?</Text>
          {personalDefaultMinutes ? (
            <Pressable
              style={styles.defaultButton}
              onPress={() => handleEstimateChoice(personalDefaultMinutes, "preset")}
            >
              <Text style={styles.defaultButtonText}>
                Tasks like this tend to run about {personalDefaultMinutes} min
              </Text>
            </Pressable>
          ) : null}
          <View style={styles.estimateChoices}>
            {ESTIMATE_CHOICES.map((choice) => (
              <Pressable
                key={`${choice.label}-${choice.inputType}`}
                style={[
                  styles.estimateChip,
                  estimatedMinutes === choice.minutes &&
                    estimateInputType === choice.inputType &&
                    styles.selectedEstimateChip,
                ]}
                onPress={() =>
                  handleEstimateChoice(choice.minutes, choice.inputType)
                }
              >
                <Text style={styles.estimateChipText}>{choice.label}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.customEstimateRow}>
            <TextInput
              style={styles.smallInput}
              keyboardType="numeric"
              placeholder="Custom min"
              placeholderTextColor="#363636"
              value={customEstimate}
              onChangeText={setCustomEstimate}
            />
            <Pressable style={styles.smallButton} onPress={handleCustomEstimate}>
              <Text style={styles.smallButtonText}>Set</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Text style={styles.helperText}>
          {estimatedMinutes == null
            ? "No estimate locked for this one."
            : `Estimate locked at ${estimatedMinutes} min.`}
        </Text>
      )}

      <View style={styles.timerActions}>
        {!isRunning ? (
          <Pressable onPress={handleStart} style={styles.timerButton}>
            <Text style={styles.timerButtonText}>Start</Text>
          </Pressable>
        ) : (
          <Pressable onPress={handlePause} style={styles.timerButton}>
            <Text style={styles.timerButtonText}>Pause</Text>
          </Pressable>
        )}
        <Pressable
          onPress={handleDone}
          style={[styles.doneButton, isSaving && styles.disabledButton]}
          disabled={isSaving}
        >
          <Text style={styles.timerButtonText}>Done</Text>
        </Pressable>
        <Pressable onPress={reset} style={styles.secondaryTimerButton}>
          <Text style={styles.timerButtonText}>Reset</Text>
        </Pressable>
        <Pressable onPress={openAdjustTime} style={styles.secondaryTimerButton}>
          <Text style={styles.timerButtonText}>Adjust time</Text>
        </Pressable>
        <Pressable onPress={openManualTime} style={styles.secondaryTimerButton}>
          <Text style={styles.timerButtonText}>Add time manually</Text>
        </Pressable>
      </View>

      {reviewState ? (
        <View style={styles.reviewBlock}>
          <Text style={styles.reviewTitle}>{reviewState.title}</Text>
          <Text style={styles.reviewText}>{reviewState.description}</Text>
          <Text style={styles.reviewText}>
            Timer measured {formatDurationLabel(reviewState.timerSeconds)}
            {estimatedMinutes == null ? "" : ` · felt like ${estimatedMinutes} min`}
          </Text>
          <View style={styles.customEstimateRow}>
            <TextInput
              style={styles.smallInput}
              keyboardType="numeric"
              placeholder="Actual min"
              placeholderTextColor="#363636"
              value={actualMinutesInput}
              onChangeText={setActualMinutesInput}
            />
            <Pressable
              style={[styles.smallButton, isSaving && styles.disabledButton]}
              onPress={saveReviewedTime}
              disabled={isSaving}
            >
              <Text style={styles.smallButtonText}>Save this time</Text>
            </Pressable>
          </View>
          <View style={styles.timerActions}>
            {reviewState.timerSeconds > 0 ? (
              <Pressable
                style={styles.timerButton}
                onPress={saveFullReviewedTime}
                disabled={isSaving}
              >
                <Text style={styles.timerButtonText}>Keep full time</Text>
              </Pressable>
            ) : null}
            <Pressable
              style={styles.secondaryTimerButton}
              onPress={excludeReviewedTime}
              disabled={isSaving}
            >
              <Text style={styles.timerButtonText}>Do not count this one</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {feedback ? <Text style={styles.feedbackText}>{feedback}</Text> : null}
    </View>
  );
};

export default TaskItem;

const styles = StyleSheet.create({
  timerContainer: {
    backgroundColor: "#d8cec3",
    borderColor: "#201f1f",
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
  },
  timerHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  timerLabel: {
    color: "#050505",
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  timerStatus: {
    color: "#050505",
    fontSize: 13,
    fontWeight: "700",
  },
  elapsedTime: {
    color: "#050505",
    fontSize: 34,
    fontWeight: "900",
    marginTop: 8,
  },
  estimateBlock: {
    borderTopColor: "#b9afa4",
    borderTopWidth: 1,
    gap: 10,
    marginTop: 12,
    paddingTop: 12,
  },
  helperText: {
    color: "#201f1f",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 8,
  },
  estimateChoices: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  estimateChip: {
    alignItems: "center",
    backgroundColor: "#f7efe7",
    borderColor: "#b9afa4",
    borderRadius: 7,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 34,
    paddingHorizontal: 12,
  },
  selectedEstimateChip: {
    backgroundColor: "#9ccf9b",
    borderColor: "#315f30",
  },
  estimateChipText: {
    color: "#050505",
    fontSize: 13,
    fontWeight: "800",
  },
  defaultButton: {
    alignItems: "center",
    backgroundColor: "#fff7cf",
    borderRadius: 7,
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: 12,
  },
  defaultButtonText: {
    color: "#050505",
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
  },
  customEstimateRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  smallInput: {
    backgroundColor: "#fffaf4",
    borderColor: "#8c8278",
    borderRadius: 7,
    borderWidth: 1,
    color: "#050505",
    minHeight: 38,
    minWidth: 120,
    paddingHorizontal: 10,
  },
  smallButton: {
    alignItems: "center",
    backgroundColor: "#ffefe7",
    borderRadius: 7,
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: 14,
  },
  smallButtonText: {
    color: "#050505",
    fontSize: 14,
    fontWeight: "800",
  },
  timerActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  timerButton: {
    alignItems: "center",
    backgroundColor: "#ffefe7",
    borderRadius: 7,
    justifyContent: "center",
    minHeight: 36,
    paddingHorizontal: 14,
  },
  secondaryTimerButton: {
    alignItems: "center",
    backgroundColor: "#f8b5ad",
    borderRadius: 7,
    justifyContent: "center",
    minHeight: 36,
    paddingHorizontal: 14,
  },
  doneButton: {
    alignItems: "center",
    backgroundColor: "#9ccf9b",
    borderRadius: 7,
    justifyContent: "center",
    minHeight: 36,
    paddingHorizontal: 14,
  },
  disabledButton: {
    opacity: 0.6,
  },
  timerButtonText: {
    color: "#050505",
    fontSize: 14,
    fontWeight: "800",
  },
  reviewBlock: {
    backgroundColor: "#fffaf4",
    borderColor: "#8c8278",
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    marginTop: 12,
    padding: 12,
  },
  reviewTitle: {
    color: "#050505",
    fontSize: 16,
    fontWeight: "900",
  },
  reviewText: {
    color: "#201f1f",
    fontSize: 14,
    lineHeight: 20,
  },
  feedbackText: {
    color: "#201f1f",
    fontSize: 14,
    fontWeight: "800",
    marginTop: 12,
  },
});
