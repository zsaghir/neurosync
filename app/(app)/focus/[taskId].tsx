import { design } from "@/constants/design";
import { useActiveTimer } from "@/context/ActiveTimerContext";
import { useTask, useTaskSessions } from "@/hooks/queries/tasks";
import { useTaskSession } from "@/hooks/use-task-session";
import { useTimer } from "@/hooks/use-timer";
import { taskErrorMessage } from "@/lib/api/client";
import formattime from "@/lib/utils/formattime";
import {
  formatDurationLabel,
  shouldPromptForLongSession,
  shouldPromptForShortSession,
} from "@/lib/utils/time-wisdom";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const colors = design.colors.light; // focus timer surfaces are always dark

function varianceMessage(estimatedMinutes: number | null, actualSeconds: number) {
  if (estimatedMinutes == null) return null;

  const actualMinutes = actualSeconds / 60;
  const diff = actualMinutes - estimatedMinutes;

  if (Math.abs(diff) < Math.max(2, estimatedMinutes * 0.15)) {
    return `You guessed ${estimatedMinutes} — that's close. Nice read.`;
  }

  return `You guessed ${estimatedMinutes} — it ran ${
    diff < 0 ? "shorter" : "longer"
  }. That's useful data, not a miss.`;
}

export default function FocusTimerScreen() {
  const { taskId, checkInMinutes, checkInNextStep } = useLocalSearchParams<{
    taskId: string;
    checkInMinutes?: string;
    checkInNextStep?: string;
  }>();
  const router = useRouter();
  const { setActiveTimer } = useActiveTimer();

  // Task Details already cached this task and its sessions, so the timer can
  // render immediately instead of fetching them again behind a spinner.
  const taskQuery = useTask(taskId);
  const sessionsQuery = useTaskSessions();
  const task = taskQuery.data ?? null;
  const sessions = sessionsQuery.data ?? [];
  const [pendingElapsedSeconds, setPendingElapsedSeconds] = useState<number | null>(
    null,
  );

  const timer = useTimer(taskId ?? "");
  const {
    elapsedSeconds,
    accumulatedSeconds,
    isRunning,
    runStartedAtMs,
    startedAt,
    start,
    pause,
  } = timer;

  const session = useTaskSession({
    task: task ?? { _id: taskId ?? "" },
    sessions,
    startedAt,
  });

  // Auto-start once, as soon as the task is available.
  const hasAutoStarted = useRef(false);
  useEffect(() => {
    if (!task || hasAutoStarted.current) return;
    hasAutoStarted.current = true;
    start();
  }, [task, start]);

  // This screen is the only writer of the shared active timer, and it
  // publishes the exact values its own clock uses, so the task list's
  // "Focusing" label always matches this countdown.
  const activeTaskId = task?._id ?? null;
  useEffect(() => {
    if (!activeTaskId || !isRunning || runStartedAtMs == null) {
      setActiveTimer(null);
      return;
    }
    setActiveTimer({
      taskId: activeTaskId,
      startedAt: runStartedAtMs,
      accumulatedSeconds,
    });
  }, [activeTaskId, isRunning, runStartedAtMs, accumulatedSeconds, setActiveTimer]);
  useEffect(() => () => setActiveTimer(null), [setActiveTimer]);

  const isReviewing = pendingElapsedSeconds != null || session.reviewState != null;

  const closeScreen = () => router.back();

  const handleDone = async () => {
    const finalElapsed = Math.round(isRunning ? (await pause()) ?? elapsedSeconds : elapsedSeconds);

    const longOrShort =
      shouldPromptForLongSession(finalElapsed, task?.estimatedMinutes ?? null) ||
      shouldPromptForShortSession(finalElapsed);

    if (longOrShort) {
      await session.handleDone(finalElapsed);
    } else {
      setPendingElapsedSeconds(finalElapsed);
    }
  };

  const handlePauseResume = () => {
    if (isRunning) {
      void pause();
    } else {
      start();
    }
  };

  const handleSaveNormal = async () => {
    if (pendingElapsedSeconds == null) return;
    await session.saveSession({
      timerSeconds: pendingElapsedSeconds,
      actualSeconds: pendingElapsedSeconds,
      actualSecondsSource: "timer",
    });
    router.back();
  };

  const handleAdjustFromGeneric = () => {
    if (pendingElapsedSeconds == null) return;
    session.openAdjustTime(pendingElapsedSeconds, pendingElapsedSeconds);
    setPendingElapsedSeconds(null);
  };

  const handleExcludeFromGeneric = async () => {
    if (pendingElapsedSeconds == null) return;
    await session.saveSession({
      timerSeconds: pendingElapsedSeconds,
      actualSeconds: pendingElapsedSeconds,
      actualSecondsSource: "timer",
      excludedFromInsights: true,
      excludeReason: "manual-review",
    });
    router.back();
  };

  const handleSaveReviewed = async () => {
    await session.saveReviewedTime();
    router.back();
  };

  const handleKeepFullTime = async () => {
    await session.saveFullReviewedTime();
    router.back();
  };

  const handleExcludeReviewed = async () => {
    await session.excludeReviewedTime();
    router.back();
  };

  const variance = useMemo(
    () =>
      pendingElapsedSeconds != null
        ? varianceMessage(task?.estimatedMinutes ?? null, pendingElapsedSeconds)
        : null,
    [pendingElapsedSeconds, task?.estimatedMinutes],
  );

  if (!task) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.focusBackground }]}>
        <View style={styles.centerFill}>
          {taskQuery.isPending ? (
            <ActivityIndicator color={colors.focusAccent} />
          ) : (
            <>
              <Text accessibilityRole="alert" style={styles.loadErrorText}>
                {taskErrorMessage(taskQuery.error, "Couldn't load this task.")}
              </Text>
              <Pressable accessibilityRole="button" onPress={() => void taskQuery.refetch()} style={styles.primaryTextTarget}>
                <Text style={styles.doneText}>Retry</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={closeScreen} style={styles.secondaryTextTarget}>
                <Text style={styles.pauseText}>Close</Text>
              </Pressable>
            </>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.focusBackground }]}>
      <View style={styles.header}>
        <View />
        <Pressable
          accessibilityLabel="Close"
          accessibilityRole="button"
          onPress={closeScreen}
          hitSlop={design.spacing.md}
        >
          <Text style={styles.closeIcon}>×</Text>
        </Pressable>
      </View>

      {!isReviewing ? (
        <View style={styles.runningBody}>
          <Text style={styles.taskName}>{task.title}</Text>
          {checkInNextStep ? (
            <Text style={styles.checkInStep}>{checkInNextStep}</Text>
          ) : null}
          <Text style={styles.countdown}>{formattime(elapsedSeconds)}</Text>
          <Text style={styles.estimateLine}>
            {checkInMinutes
              ? `${checkInMinutes}-minute experiment`
              : task.estimatedMinutes != null
              ? `${task.estimatedMinutes} min estimated`
              : "No estimate for this one"}
          </Text>

          <Pressable
            onPress={() => void handleDone()}
            disabled={session.isSaving}
            style={styles.primaryTextTarget}
          >
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
          <Pressable onPress={handlePauseResume} style={styles.secondaryTextTarget}>
            <Text style={styles.pauseText}>{isRunning ? "Pause" : "Resume"}</Text>
          </Pressable>
        </View>
      ) : session.reviewState ? (
        <View style={styles.reviewBody}>
          <Text style={styles.reviewHeadline}>{session.reviewState.title}</Text>
          <Text style={styles.reviewBanner}>{session.reviewState.description}</Text>

          <View style={styles.minutesRow}>
            <TextInput
              style={styles.minutesInput}
              keyboardType="numeric"
              placeholder="Minutes"
              placeholderTextColor={colors.focusMuted}
              value={session.actualMinutesInput}
              onChangeText={session.setActualMinutesInput}
            />
            <Text style={styles.minutesUnit}>min</Text>
          </View>

          <Pressable
            onPress={() => void handleSaveReviewed()}
            disabled={session.isSaving}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>Save</Text>
          </Pressable>
          <View style={styles.reviewLinksRow}>
            {session.reviewState.timerSeconds > 0 ? (
              <Pressable onPress={() => void handleKeepFullTime()}>
                <Text style={styles.linkTextAccent}>Keep full time</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={() => void handleExcludeReviewed()}>
              <Text style={styles.linkTextMuted}>Don&rsquo;t count this one</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.reviewBody}>
          <Text style={styles.reviewMinutesLabel}>
            {formatDurationLabel(pendingElapsedSeconds ?? 0)}.
          </Text>
          <Text style={styles.reviewHeadline}>Nice work showing up.</Text>
          {variance ? <Text style={styles.reviewBanner}>{variance}</Text> : null}

          <Pressable
            onPress={() => void handleSaveNormal()}
            disabled={session.isSaving}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>Save</Text>
          </Pressable>
          <View style={styles.reviewLinksRow}>
            <Pressable onPress={handleAdjustFromGeneric}>
              <Text style={styles.linkTextAccent}>Adjust time</Text>
            </Pressable>
            <Pressable onPress={() => void handleExcludeFromGeneric()}>
              <Text style={styles.linkTextMuted}>Don&rsquo;t count this one</Text>
            </Pressable>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  centerFill: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: design.spacing.xl,
  },
  loadErrorText: {
    color: colors.focusText,
    fontSize: design.type.body,
    textAlign: "center",
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    height: 44,
    justifyContent: "space-between",
    paddingHorizontal: design.spacing.lg,
  },
  closeIcon: {
    color: colors.focusFaint,
    fontSize: 22,
  },
  runningBody: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: design.spacing.xl,
  },
  taskName: {
    color: colors.focusMuted,
    fontSize: design.type.meta + 1,
    textAlign: "center",
  },
  checkInStep: {
    color: colors.focusText,
    fontSize: design.type.body + 1,
    fontWeight: "700",
    lineHeight: 24,
    marginTop: design.spacing.sm,
    maxWidth: 440,
    textAlign: "center",
  },
  countdown: {
    color: colors.focusText,
    fontSize: design.type.countdown,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
    letterSpacing: -1,
    marginVertical: design.spacing.lg,
  },
  estimateLine: {
    color: colors.focusFaint,
    fontSize: design.type.meta,
    marginBottom: design.spacing.xxxl + 4,
  },
  primaryTextTarget: {
    justifyContent: "center",
    minHeight: design.touchTarget,
  },
  doneText: {
    color: colors.focusAccent,
    fontSize: design.type.body + 1,
    fontWeight: "700",
  },
  secondaryTextTarget: {
    justifyContent: "center",
    marginTop: design.spacing.sm,
    minHeight: design.touchTarget,
  },
  pauseText: {
    color: colors.focusFaint,
    fontSize: design.type.meta,
  },
  reviewBody: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: design.spacing.xl + 6,
  },
  reviewMinutesLabel: {
    color: colors.focusMuted,
    fontSize: design.type.body,
  },
  reviewHeadline: {
    color: colors.focusText,
    fontSize: design.type.screenTitle - 2,
    fontWeight: "800",
    marginTop: 4,
  },
  reviewBanner: {
    backgroundColor: colors.focusReviewBanner,
    borderRadius: design.radius.lg,
    color: colors.focusReviewBannerText,
    fontSize: design.type.meta + 0.5,
    lineHeight: 21,
    marginTop: design.spacing.lg,
    padding: design.spacing.md,
  },
  minutesRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: design.spacing.xs,
    marginTop: design.spacing.lg,
  },
  minutesInput: {
    backgroundColor: colors.focusReviewBanner,
    borderRadius: design.radius.md,
    color: colors.focusText,
    flex: 1,
    fontSize: design.type.body + 1,
    minHeight: design.touchTarget,
    paddingHorizontal: design.spacing.sm,
  },
  minutesUnit: {
    color: colors.focusMuted,
    fontSize: design.type.meta,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: design.radius.pill,
    height: 52,
    justifyContent: "center",
    marginTop: design.spacing.xl - 2,
  },
  primaryButtonText: {
    color: colors.accentText,
    fontSize: 16,
    fontWeight: "700",
  },
  reviewLinksRow: {
    flexDirection: "row",
    gap: design.spacing.lg,
    justifyContent: "center",
    marginTop: design.spacing.md,
  },
  linkTextAccent: {
    color: colors.focusAccent,
    fontSize: design.type.meta,
    fontWeight: "700",
    minHeight: design.touchTarget,
    paddingTop: design.spacing.xs,
  },
  linkTextMuted: {
    color: colors.focusMuted,
    fontSize: design.type.meta,
    minHeight: design.touchTarget,
    paddingTop: design.spacing.xs,
  },
});
