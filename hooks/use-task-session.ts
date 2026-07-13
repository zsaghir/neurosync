import { addTimeToTask, type TaskDocument } from "@/lib/sanity/tasks";
import {
  createTaskSession,
  type TaskSessionDocument,
} from "@/lib/sanity/taskSessions";
import {
  type ActualSecondsSource,
  formatDurationLabel,
  isCleanCountedSession,
  shouldPromptForLongSession,
  shouldPromptForShortSession,
  shouldShowDoneReflection,
} from "@/lib/utils/time-wisdom";
import { useMemo, useState } from "react";

export type ReviewReason = "adjust" | "long" | "short" | "manual";

export type ReviewState = {
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

type UseTaskSessionArgs = {
  task: TaskDocument;
  userId: string;
  sessions: TaskSessionDocument[];
  startedAt: string | null;
  onTimeCommitted?: (taskId: string, seconds: number) => void;
  onComplete?: (taskId: string) => void;
  onSessionSaved?: (session: TaskSessionDocument) => void;
};

/**
 * Timer/session save + review-state logic, extracted from the old
 * TaskItem.tsx modal so it can be shared by the full-screen focus timer,
 * Task Details' "Adjust time" action, and the manual time entry sheet.
 */
export function useTaskSession({
  task,
  userId,
  sessions,
  startedAt,
  onTimeCommitted,
  onComplete,
  onSessionSaved,
}: UseTaskSessionArgs) {
  const [reviewState, setReviewState] = useState<ReviewState | null>(null);
  const [actualMinutesInput, setActualMinutesInput] = useState("");
  const [feedback, setFeedback] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const estimatedMinutes = task.estimatedMinutes ?? null;
  const estimateInputType = estimatedMinutes == null ? "skipped" : "custom";

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

      return session;
    } finally {
      setIsSaving(false);
    }
  };

  const handleDone = async (finalElapsedSeconds: number) => {
    const timerSeconds = Math.round(finalElapsedSeconds);

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

  const openAdjustTime = (elapsedSeconds: number, accumulatedSeconds: number) => {
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
    return saveSession({
      timerSeconds: reviewState.timerSeconds,
      actualSeconds,
      actualSecondsSource:
        reviewState.reason === "manual" ? "manual" : "userEdited",
    });
  };

  const saveFullReviewedTime = async () => {
    if (!reviewState) return;

    return saveSession({
      timerSeconds: reviewState.timerSeconds,
      actualSeconds: reviewState.timerSeconds,
      actualSecondsSource: "timer",
    });
  };

  const excludeReviewedTime = async () => {
    if (!reviewState) return;

    return saveSession({
      timerSeconds: reviewState.timerSeconds,
      actualSeconds: parseMinutes(actualMinutesInput) * 60,
      actualSecondsSource: reviewState.actualSecondsSource,
      excludedFromInsights: true,
      excludeReason: reviewState.reason,
    });
  };

  const clearReview = () => {
    setReviewState(null);
    setActualMinutesInput("");
  };

  const clearFeedback = () => setFeedback("");

  return {
    estimatedMinutes,
    reviewState,
    actualMinutesInput,
    setActualMinutesInput,
    feedback,
    isSaving,
    handleDone,
    openAdjustTime,
    openManualTime,
    saveReviewedTime,
    saveFullReviewedTime,
    excludeReviewedTime,
    clearReview,
    clearFeedback,
    saveSession,
  };
}
