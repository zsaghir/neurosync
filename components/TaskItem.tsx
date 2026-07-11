import { useTimer } from "@/hooks/use-timer";
import { addTimeToTask, type TaskDocument } from "@/lib/sanity/tasks";
import {
  createTaskSession,
  type TaskSessionDocument,
} from "@/lib/sanity/taskSessions";
import formattime from "@/lib/utils/formattime";
import {
  type ActualSecondsSource,
  formatDurationLabel,
  isCleanCountedSession,
  shouldPromptForLongSession,
  shouldPromptForShortSession,
  shouldShowDoneReflection,
  type ThemeMode,
} from "@/lib/utils/time-wisdom";
import Ionicons from "@expo/vector-icons/Ionicons";
import React, { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

type TaskItemProps = {
  task: TaskDocument;
  userId: string;
  sessions: TaskSessionDocument[];
  themeMode: ThemeMode;
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
  sessions,
  themeMode,
  onTimeCommitted,
  onComplete,
  onSessionSaved,
}: TaskItemProps) => {
  const {
    elapsedSeconds,
    accumulatedSeconds,
    isRunning,
    startedAt,
    start,
    pause,
    reset,
  } = useTimer(task._id);
  const [isOpen, setIsOpen] = useState(false);
  const [reviewState, setReviewState] = useState<ReviewState | null>(null);
  const [actualMinutesInput, setActualMinutesInput] = useState("");
  const [feedback, setFeedback] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const estimatedMinutes = task.estimatedMinutes ?? null;
  const estimateInputType = estimatedMinutes == null ? "skipped" : "custom";
  const theme = timerThemes[themeMode];

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

  const handleStart = () => {
    setIsOpen(true);
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

      const shouldReflect =
        isCleanCountedSession({
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
      setIsOpen(false);
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
    <>
      <Pressable
        style={[styles.inlineButton, { borderColor: theme.line }]}
        onPress={handleStart}
      >
        <Ionicons
          name={isRunning ? "pause" : "play"}
          size={16}
          color={theme.text}
        />
      </Pressable>

      <Modal
        animationType="fade"
        transparent
        visible={isOpen}
        onRequestClose={() => setIsOpen(false)}
      >
        <View style={styles.overlay}>
          <View
            style={[
              styles.timerContainer,
              { backgroundColor: theme.surface, borderColor: theme.line },
            ]}
          >
            <View style={styles.timerHeader}>
              <Text style={[styles.timerLabel, { color: theme.subtle }]}>
                Focus timer
              </Text>
              <Pressable onPress={() => setIsOpen(false)}>
                <Ionicons name="close" size={22} color={theme.text} />
              </Pressable>
            </View>

            <Text style={[styles.elapsedTime, { color: theme.text }]}>
              {formattime(elapsedSeconds)}
            </Text>
            <Text style={[styles.helperText, { color: theme.subtle }]}>
              {estimatedMinutes == null
                ? "No estimate for this one."
                : `Estimate locked at ${estimatedMinutes} min.`}
            </Text>

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
              <Pressable
                onPress={openAdjustTime}
                style={styles.secondaryTimerButton}
              >
                <Text style={styles.timerButtonText}>Adjust time</Text>
              </Pressable>
              <Pressable
                onPress={openManualTime}
                style={styles.secondaryTimerButton}
              >
                <Text style={styles.timerButtonText}>Add time manually</Text>
              </Pressable>
            </View>

            {reviewState ? (
              <View
                style={[
                  styles.reviewBlock,
                  { backgroundColor: theme.review, borderColor: theme.line },
                ]}
              >
                <Text style={[styles.reviewTitle, { color: theme.text }]}>
                  {reviewState.title}
                </Text>
                <Text style={[styles.reviewText, { color: theme.subtle }]}>
                  {reviewState.description}
                </Text>
                <Text style={[styles.reviewText, { color: theme.subtle }]}>
                  Timer measured {formatDurationLabel(reviewState.timerSeconds)}
                  {estimatedMinutes == null
                    ? ""
                    : ` · felt like ${estimatedMinutes} min`}
                </Text>
                <View style={styles.customEstimateRow}>
                  <TextInput
                    style={[
                      styles.smallInput,
                      {
                        backgroundColor: theme.input,
                        borderColor: theme.line,
                        color: theme.text,
                      },
                    ]}
                    keyboardType="numeric"
                    placeholder="Actual min"
                    placeholderTextColor={theme.subtle}
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
                    <Text style={styles.timerButtonText}>
                      Do not count this one
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            {feedback ? (
              <Text style={[styles.feedbackText, { color: theme.subtle }]}>
                {feedback}
              </Text>
            ) : null}
          </View>
        </View>
      </Modal>
    </>
  );
};

export default TaskItem;

const timerThemes = {
  dark: {
    surface: "#151515",
    review: "#202020",
    input: "#0f0f0f",
    line: "#f2efe6",
    text: "#f8f5ee",
    subtle: "#c7c0b2",
  },
  light: {
    surface: "#fbf7ef",
    review: "#f1eadf",
    input: "#fffdf8",
    line: "#2b2925",
    text: "#25231f",
    subtle: "#655f55",
  },
};

const styles = StyleSheet.create({
  inlineButton: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  overlay: {
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.54)",
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
  timerContainer: {
    borderRadius: 8,
    borderWidth: 1,
    maxWidth: 560,
    padding: 18,
    width: "100%",
  },
  timerHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  timerLabel: {
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  elapsedTime: {
    fontSize: 42,
    fontWeight: "900",
    marginTop: 8,
  },
  helperText: {
    fontSize: 14,
    fontWeight: "700",
    marginTop: 8,
  },
  customEstimateRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  smallInput: {
    borderRadius: 7,
    borderWidth: 1,
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
    marginTop: 14,
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
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    marginTop: 14,
    padding: 12,
  },
  reviewTitle: {
    fontSize: 16,
    fontWeight: "900",
  },
  reviewText: {
    fontSize: 14,
    lineHeight: 20,
  },
  feedbackText: {
    fontSize: 14,
    fontWeight: "800",
    marginTop: 12,
  },
});
