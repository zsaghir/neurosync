import { AppCard, AppScreen, SectionLabel, StatusMessage } from "@/components/ui/design-system";
import { design } from "@/constants/design";
import { useAppTheme } from "@/context/AppThemeContext";
import {
  fetchCheckInInsights,
  type CheckInInsightPattern,
  type CheckInInsights,
} from "@/lib/api/insights";
import {
  blockerLabel,
  describeInsufficientData,
  describeStucknessChange,
  formatPercentage,
  formatSupportAction,
  getInsightsViewState,
  groupInsightPatterns,
  insightAccessibilityLabel,
} from "@/lib/insights/check-in-insights";
import { useAuth } from "@clerk/clerk-expo";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

export default function InsightsScreen() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { colors } = useAppTheme();
  const getTokenRef = useRef(getToken);
  const [insights, setInsights] = useState<CheckInInsights | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  const loadInsights = useCallback(async () => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      setInsights(await fetchCheckInInsights(getTokenRef.current));
    } catch (loadError) {
      console.error("Error loading check-in insights:", loadError);
      setError("We couldn't load your insights. Check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  }, [isLoaded, isSignedIn]);

  useFocusEffect(
    useCallback(() => {
      void loadInsights();
    }, [loadInsights]),
  );

  const viewState = getInsightsViewState(isLoading, error, insights);

  return (
    <AppScreen contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: colors.text }]}>Insights</Text>
      <Text style={[styles.intro, { color: colors.textMuted }]}>Patterns from your check-in follow-ups—not medical conclusions or proof that a strategy caused a result.</Text>

      {viewState === "loading" ? (
        <StatusMessage loading>Looking for patterns in your check-ins…</StatusMessage>
      ) : null}

      {viewState === "error" ? (
        <AppCard style={styles.messageCard}>
          <Text style={[styles.messageTitle, { color: colors.text }]}>Insights could not load</Text>
          <Text style={[styles.messageText, { color: colors.textMuted }]}>{error}</Text>
          <Pressable
            accessibilityLabel="Retry loading insights"
            accessibilityRole="button"
            onPress={() => void loadInsights()}
            style={[styles.retryButton, { borderColor: colors.accent }]}
          >
            <Text style={[styles.retryText, { color: colors.accent }]}>Retry</Text>
          </Pressable>
        </AppCard>
      ) : null}

      {viewState === "empty" ? (
        <AppCard style={styles.messageCard}>
          <Text style={[styles.messageTitle, { color: colors.text }]}>No check-in patterns yet</Text>
          <Text style={[styles.messageText, { color: colors.textMuted }]}>Complete a check-in and its follow-up to begin collecting personal evidence. NeuroSync waits for repeated attempts before comparing patterns.</Text>
        </AppCard>
      ) : null}

      {viewState === "populated" && insights ? (
        <>
          <View style={styles.summaryRow}>
            <SummaryCard label="Check-ins" value={String(insights.totalCheckIns)} />
            <SummaryCard label="Follow-ups" value={String(insights.completedFollowUps)} />
            <SummaryCard label="Follow-up rate" value={formatPercentage(insights.followUpRate)} />
          </View>

          <SectionLabel style={styles.patternsLabel}>Patterns by blocker</SectionLabel>
          {insights.patterns.length === 0 ? (
            <AppCard>
              <Text style={[styles.messageText, { color: colors.textMuted }]}>Your check-ins do not have a support strategy to compare yet.</Text>
            </AppCard>
          ) : (
            groupInsightPatterns(insights.patterns).map((group) => (
              <View key={group.blocker} style={styles.group}>
                <Text style={[styles.groupTitle, { color: colors.text }]}>{blockerLabel(group.blocker)}</Text>
                {group.patterns.map((pattern) => (
                  <PatternCard key={`${pattern.blocker}-${pattern.supportAction}`} pattern={pattern} />
                ))}
              </View>
            ))
          )}
        </>
      ) : null}
    </AppScreen>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  const { colors } = useAppTheme();
  return (
    <AppCard style={styles.summaryCard}>
      <Text style={[styles.summaryValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>{label}</Text>
    </AppCard>
  );
}

function PatternCard({ pattern }: { pattern: CheckInInsightPattern }) {
  const { colors } = useAppTheme();
  const percentage = pattern.successRate == null
    ? null
    : Math.round(pattern.successRate * 100);

  return (
    <AppCard style={styles.patternCard}>
      <View accessible accessibilityLabel={insightAccessibilityLabel(pattern)}>
        <Text style={[styles.patternTitle, { color: colors.text }]}>{formatSupportAction(pattern.supportAction)}</Text>
        <View style={styles.resultRow}>
          <Text style={[styles.rate, { color: colors.text }]}>{formatPercentage(pattern.successRate)}</Text>
          <Text style={[styles.attempts, { color: colors.textMuted }]}>
            {pattern.attemptedCount === 0
              ? "No attempts recorded yet"
              : `Started ${pattern.nextStepTakenCount} of ${pattern.attemptedCount} attempts`}
          </Text>
        </View>
        {percentage != null ? (
          <View
            accessibilityLabel={`Next-step rate ${percentage}%`}
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: 100, now: percentage }}
            style={[styles.track, { backgroundColor: colors.barMuted }]}
          >
            <View style={[styles.fill, { backgroundColor: colors.barHighlight, width: `${Math.min(100, Math.max(0, percentage))}%` }]} />
          </View>
        ) : null}
        <Text style={[styles.changeText, { color: colors.textMuted }]}>{describeStucknessChange(pattern)}</Text>
        <Text style={[styles.sampleText, { color: colors.textMuted }]}>{pattern.createdCheckIns} check-ins · {pattern.completedFollowUps} completed follow-ups</Text>
      </View>
      {pattern.insufficientData ? (
        <View style={[styles.insufficientNotice, { backgroundColor: colors.accentSoft }]}>
          <Text style={[styles.insufficientText, { color: colors.accentSoftText }]}>{describeInsufficientData(pattern.attemptedCount)}</Text>
        </View>
      ) : null}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: design.spacing.huge },
  title: { fontSize: design.type.screenTitle, fontWeight: "800" },
  intro: { fontSize: design.type.body, lineHeight: 21, marginBottom: design.spacing.xl, marginTop: design.spacing.xs },
  messageCard: { marginTop: design.spacing.md },
  messageTitle: { fontSize: design.type.cardTitle, fontWeight: "700" },
  messageText: { fontSize: design.type.body, lineHeight: 21, marginTop: design.spacing.xs },
  retryButton: { alignItems: "center", borderRadius: design.radius.pill, borderWidth: 1, justifyContent: "center", marginTop: design.spacing.md, minHeight: design.touchTarget },
  retryText: { fontSize: design.type.body, fontWeight: "700" },
  summaryRow: { flexDirection: "row", gap: design.spacing.xs },
  summaryCard: { flex: 1, minWidth: 0, padding: design.spacing.sm },
  summaryValue: { fontSize: design.type.cardTitle, fontWeight: "800" },
  summaryLabel: { fontSize: design.type.caption, lineHeight: 14, marginTop: design.spacing.xxs },
  patternsLabel: { marginBottom: design.spacing.sm, marginTop: design.spacing.xl },
  group: { gap: design.spacing.sm, marginBottom: design.spacing.xl },
  groupTitle: { fontSize: design.type.cardTitle - 2, fontWeight: "700" },
  patternCard: { gap: design.spacing.md },
  patternTitle: { fontSize: design.type.cardTitle, fontWeight: "700" },
  resultRow: { alignItems: "flex-end", flexDirection: "row", gap: design.spacing.sm, marginTop: design.spacing.md },
  rate: { fontSize: design.type.screenTitle, fontWeight: "800" },
  attempts: { flex: 1, fontSize: design.type.meta, lineHeight: 18, paddingBottom: 3 },
  track: { borderRadius: design.radius.pill, height: 8, marginTop: design.spacing.sm, overflow: "hidden" },
  fill: { borderRadius: design.radius.pill, height: "100%" },
  changeText: { fontSize: design.type.body, lineHeight: 21, marginTop: design.spacing.md },
  sampleText: { fontSize: design.type.caption, marginTop: design.spacing.xs },
  insufficientNotice: { borderRadius: design.radius.md, padding: design.spacing.sm },
  insufficientText: { fontSize: design.type.meta, fontWeight: "600", lineHeight: 18 },
});
