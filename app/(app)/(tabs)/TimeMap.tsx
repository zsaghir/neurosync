import { InsightBanner } from "@/components/ui/InsightBanner";
import { StatCard } from "@/components/ui/StatCard";
import { WeeklyBarGraph } from "@/components/ui/WeeklyBarGraph";
import { AppCard, SectionLabel } from "@/components/ui/design-system";
import { design } from "@/constants/design";
import { useAppTheme } from "@/context/AppThemeContext";
import {
  fetchTaskSessions,
  updateTaskSessionActualTime,
  updateTaskSessionExclusion,
  type TaskSessionDocument,
} from "@/lib/sanity/taskSessions";
import { addTimeToTask } from "@/lib/sanity/tasks";
import { getWeeklyMinutesByDay } from "@/lib/utils/today";
import {
  formatDurationLabel,
  isCleanCountedSession,
  median,
} from "@/lib/utils/time-wisdom";
import { useUser } from "@clerk/clerk-expo";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const formatSource = (source: TaskSessionDocument["actualSecondsSource"]) => {
  if (source === "manual") return "manual";
  if (source === "userEdited") return "edited";

  return "timer";
};

const RECENT_SESSIONS_PREVIEW = 5;

export default function TimeMap() {
  const { user } = useUser();
  const { colors } = useAppTheme();
  const [sessions, setSessions] = useState<TaskSessionDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editedMinutes, setEditedMinutes] = useState("");
  const [isAllSessionsVisible, setIsAllSessionsVisible] = useState(false);

  const loadSessions = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      setSessions(await fetchTaskSessions(user.id));
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void loadSessions();
    }, [loadSessions]),
  );

  const countedSessions = useMemo(
    () =>
      sessions.filter(
        (session) => !session.excludedFromInsights && session.actualSeconds >= 60,
      ),
    [sessions],
  );

  const cleanSessions = useMemo(
    () =>
      countedSessions.filter((session) =>
        isCleanCountedSession({
          actualSeconds: session.actualSeconds,
          estimatedMinutes: session.estimatedMinutes,
          excludedFromInsights: session.excludedFromInsights,
          actualSecondsSource: session.actualSecondsSource,
        }),
      ),
    [countedSessions],
  );

  const medianSeconds = useMemo(
    () => median(countedSessions.map((session) => session.actualSeconds)),
    [countedSessions],
  );

  const weeklyDays = useMemo(() => getWeeklyMinutesByDay(sessions), [sessions]);
  const weeklyTotalSeconds = useMemo(
    () => weeklyDays.reduce((total, day) => total + day.minutes * 60, 0),
    [weeklyDays],
  );

  const improvementMessage = useMemo(() => {
    if (cleanSessions.length < 6) return null;

    const oldest = [...cleanSessions]
      .sort((a, b) => a.endedAt.localeCompare(b.endedAt))
      .slice(0, 3);
    const newest = [...cleanSessions]
      .sort((a, b) => b.endedAt.localeCompare(a.endedAt))
      .slice(0, 3);

    const oldGaps = oldest
      .filter((session) => session.estimatedMinutes != null)
      .map((session) =>
        Math.abs(session.actualSeconds - (session.estimatedMinutes ?? 0) * 60),
      );
    const newGaps = newest
      .filter((session) => session.estimatedMinutes != null)
      .map((session) =>
        Math.abs(session.actualSeconds - (session.estimatedMinutes ?? 0) * 60),
      );

    const oldMedian = median(oldGaps);
    const newMedian = median(newGaps);

    if (oldMedian == null || newMedian == null || newMedian >= oldMedian) {
      return null;
    }

    return "You're reading your own time better lately. Nice.";
  }, [cleanSessions]);

  const insightText =
    improvementMessage ??
    (medianSeconds == null
      ? "We're learning your real numbers so you can stop guessing."
      : "Your map is filling in with real numbers.");

  const handleStartEdit = (session: TaskSessionDocument) => {
    setEditingSessionId(session._id);
    setEditedMinutes(String(Math.max(1, Math.round(session.actualSeconds / 60))));
  };

  const handleSaveEdit = async (session: TaskSessionDocument) => {
    const parsedMinutes = Number(editedMinutes);
    const nextActualSeconds =
      Number.isFinite(parsedMinutes) && parsedMinutes > 0
        ? Math.round(parsedMinutes * 60)
        : session.actualSeconds;

    const updatedSession = await updateTaskSessionActualTime(
      session._id,
      nextActualSeconds,
      "userEdited",
    );

    if (!session.excludedFromInsights) {
      await addTimeToTask(session.taskId, nextActualSeconds - session.actualSeconds);
    }

    setSessions((currentSessions) =>
      currentSessions.map((currentSession) =>
        currentSession._id === session._id
          ? { ...currentSession, ...updatedSession }
          : currentSession,
      ),
    );
    setEditingSessionId(null);
    setEditedMinutes("");
  };

  const handleToggleCounted = async (session: TaskSessionDocument) => {
    const updatedSession = await updateTaskSessionExclusion(
      session._id,
      !session.excludedFromInsights,
      "weird",
    );

    await addTimeToTask(
      session.taskId,
      session.excludedFromInsights ? session.actualSeconds : -session.actualSeconds,
    );

    setSessions((currentSessions) =>
      currentSessions.map((currentSession) =>
        currentSession._id === session._id
          ? { ...currentSession, ...updatedSession }
          : currentSession,
      ),
    );
  };

  const visibleSessions = isAllSessionsVisible
    ? sessions
    : sessions.slice(0, RECENT_SESSIONS_PREVIEW);

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, { color: colors.text }]}>Time Map</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          A private look at how your time actually goes.
        </Text>

        {isLoading ? (
          <View style={styles.statusBlock}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : sessions.length === 0 ? (
          <AppCard style={styles.emptyCard}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              Your time map is just getting started.
            </Text>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              Every task you time fills it in a little more.
            </Text>
          </AppCard>
        ) : (
          <>
            <View style={styles.statRow}>
              <StatCard
                value={medianSeconds == null ? "—" : formatDurationLabel(medianSeconds)}
                label="Typical session"
              />
              <StatCard value={String(countedSessions.length)} label="Sessions counted" />
              <StatCard value={formatDurationLabel(weeklyTotalSeconds)} label="This week" />
            </View>

            <AppCard style={styles.graphCard}>
              <SectionLabel>Minutes per day</SectionLabel>
              <WeeklyBarGraph days={weeklyDays} />
            </AppCard>

            <InsightBanner textStyle={styles.insightSpacing}>{insightText}</InsightBanner>

            <View style={styles.sessionsHeader}>
              <SectionLabel>Recent sessions</SectionLabel>
              {sessions.length > RECENT_SESSIONS_PREVIEW ? (
                <Pressable onPress={() => setIsAllSessionsVisible((visible) => !visible)}>
                  <Text style={[styles.seeAllText, { color: colors.accent }]}>
                    {isAllSessionsVisible ? "Show less" : "See all ›"}
                  </Text>
                </Pressable>
              ) : null}
            </View>

            <View>
              {visibleSessions.map((session) => (
                <View key={session._id} style={[styles.sessionRow, { borderTopColor: colors.border }]}>
                  <View style={styles.sessionHeader}>
                    <Text style={[styles.sessionTitle, { color: colors.text }]} numberOfLines={1}>
                      {session.taskTitle || "Untitled task"}
                    </Text>
                    {session.excludedFromInsights ? (
                      <Text style={[styles.excludedTag, { color: colors.textFaint }]}>
                        not counted
                      </Text>
                    ) : null}
                  </View>
                  <Text style={[styles.sessionMeta, { color: colors.textMuted }]}>
                    {session.estimatedMinutes == null
                      ? "No estimate"
                      : `Guessed ${session.estimatedMinutes}`}{" "}
                    · ran {formatDurationLabel(session.actualSeconds)} ·{" "}
                    {formatSource(session.actualSecondsSource)}
                  </Text>

                  {editingSessionId === session._id ? (
                    <View style={styles.editRow}>
                      <TextInput
                        style={[
                          styles.editInput,
                          { borderColor: colors.border, color: colors.text, backgroundColor: colors.surfaceMuted },
                        ]}
                        keyboardType="numeric"
                        placeholder="Actual min"
                        placeholderTextColor={colors.textMuted}
                        value={editedMinutes}
                        onChangeText={setEditedMinutes}
                      />
                      <Pressable onPress={() => void handleSaveEdit(session)} style={styles.inlineAction}>
                        <Text style={[styles.inlineActionText, { color: colors.accent }]}>Save</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <View style={styles.actionsRow}>
                      <Pressable onPress={() => handleStartEdit(session)} style={styles.inlineAction}>
                        <Text style={[styles.inlineActionText, { color: colors.textMuted }]}>
                          Edit time
                        </Text>
                      </Pressable>
                      <Pressable onPress={() => void handleToggleCounted(session)} style={styles.inlineAction}>
                        <Text style={[styles.inlineActionText, { color: colors.textMuted }]}>
                          {session.excludedFromInsights ? "Count this" : "Don't count this one"}
                        </Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: design.spacing.huge * 2,
    paddingHorizontal: design.spacing.lg,
    paddingTop: design.spacing.md,
  },
  title: {
    fontSize: design.type.screenTitle,
    fontWeight: "800",
  },
  subtitle: {
    fontSize: design.type.meta + 0.5,
    marginTop: design.spacing.xxs,
  },
  statusBlock: {
    alignItems: "center",
    paddingTop: design.spacing.xxl,
  },
  emptyCard: {
    marginTop: design.spacing.xl,
  },
  emptyTitle: {
    fontSize: design.type.cardTitle - 1,
    fontWeight: "700",
  },
  emptyText: {
    fontSize: design.type.body,
    lineHeight: 20,
    marginTop: design.spacing.xs,
  },
  statRow: {
    flexDirection: "row",
    gap: design.spacing.xs + 2,
    marginTop: design.spacing.md,
  },
  graphCard: {
    marginTop: design.spacing.sm + 2,
  },
  insightSpacing: {
    marginTop: design.spacing.sm - 2,
  },
  sessionsHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: design.spacing.md - 2,
  },
  seeAllText: {
    fontSize: design.type.meta + 1,
    fontWeight: "700",
  },
  sessionRow: {
    borderTopWidth: 1,
    paddingVertical: design.spacing.sm - 2,
  },
  sessionHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: design.spacing.xs,
    justifyContent: "space-between",
  },
  sessionTitle: {
    flex: 1,
    fontSize: design.type.body,
    fontWeight: "600",
  },
  excludedTag: {
    fontSize: design.type.caption,
    fontWeight: "700",
  },
  sessionMeta: {
    fontSize: design.type.meta,
    marginTop: 2,
  },
  editRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: design.spacing.xs,
    marginTop: design.spacing.xs,
  },
  editInput: {
    borderRadius: design.radius.sm,
    borderWidth: 1,
    minHeight: 38,
    minWidth: 100,
    paddingHorizontal: design.spacing.sm,
  },
  actionsRow: {
    flexDirection: "row",
    gap: design.spacing.lg,
    marginTop: design.spacing.xs,
  },
  inlineAction: {
    justifyContent: "center",
    minHeight: design.touchTarget - 8,
  },
  inlineActionText: {
    fontSize: design.type.caption + 0.5,
    fontWeight: "700",
  },
});
