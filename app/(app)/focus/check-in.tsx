import { design } from "@/constants/design";
import { useTimer } from "@/hooks/use-timer";
import formattime from "@/lib/utils/formattime";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const colors = design.colors.light;

export default function CheckInFocusScreen() {
  const { checkInId, checkInMinutes, checkInNextStep } = useLocalSearchParams<{
    checkInId?: string;
    checkInMinutes?: string;
    checkInNextStep?: string;
  }>();
  const router = useRouter();
  const timer = useTimer(checkInId ?? "check-in");
  const [isFinished, setIsFinished] = useState(false);

  const plannedMinutes = useMemo(() => {
    const parsed = Number(checkInMinutes);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 5;
  }, [checkInMinutes]);
  const totalSeconds = plannedMinutes * 60;
  const remainingSeconds = Math.max(0, totalSeconds - timer.elapsedSeconds);

  useEffect(() => {
    timer.start();
    // Start only when this timer screen opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (timer.isRunning && timer.elapsedSeconds >= totalSeconds) {
      void timer.pause();
      setIsFinished(true);
    }
  }, [timer, totalSeconds]);

  const toggleTimer = () => {
    if (timer.isRunning) {
      void timer.pause();
    } else if (!isFinished) {
      timer.start();
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View />
        <Pressable
          accessibilityLabel="Close timer"
          accessibilityRole="button"
          hitSlop={design.spacing.md}
          onPress={() => router.back()}
        >
          <Text style={styles.closeIcon}>×</Text>
        </Pressable>
      </View>

      <View style={styles.body}>
        <Text style={styles.label}>
          {isFinished ? "Experiment complete" : "One small step"}
        </Text>
        <Text style={styles.step}>{checkInNextStep}</Text>
        <Text accessibilityRole="timer" style={styles.countdown}>
          {formattime(remainingSeconds)}
        </Text>
        <Text style={styles.duration}>{plannedMinutes}-minute experiment</Text>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.primaryTarget}
        >
          <Text style={styles.primaryText}>{isFinished ? "Continue" : "Done"}</Text>
        </Pressable>
        {!isFinished ? (
          <Pressable
            accessibilityRole="button"
            onPress={toggleTimer}
            style={styles.secondaryTarget}
          >
            <Text style={styles.secondaryText}>
              {timer.isRunning ? "Pause" : "Resume"}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.focusBackground,
    flex: 1,
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
  body: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: design.spacing.xl,
  },
  label: {
    color: colors.focusMuted,
    fontSize: design.type.meta + 1,
  },
  step: {
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
    fontVariant: ["tabular-nums"],
    fontWeight: "800",
    letterSpacing: -1,
    marginVertical: design.spacing.lg,
  },
  duration: {
    color: colors.focusFaint,
    fontSize: design.type.meta,
    marginBottom: design.spacing.xxxl + 4,
  },
  primaryTarget: {
    justifyContent: "center",
    minHeight: design.touchTarget,
  },
  primaryText: {
    color: colors.focusAccent,
    fontSize: design.type.body + 1,
    fontWeight: "700",
  },
  secondaryTarget: {
    justifyContent: "center",
    marginTop: design.spacing.sm,
    minHeight: design.touchTarget,
  },
  secondaryText: {
    color: colors.focusFaint,
    fontSize: design.type.meta,
  },
});
