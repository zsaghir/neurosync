import {
  fetchTaskSessions,
  updateTaskSessionActualTime,
  updateTaskSessionExclusion,
  type TaskSessionDocument,
} from "@/lib/sanity/taskSessions";
import { addTimeToTask } from "@/lib/sanity/tasks";
import {
  formatDurationLabel,
  isCleanCountedSession,
  median,
} from "@/lib/utils/time-wisdom";
import { useUser } from "@clerk/clerk-expo";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

const formatSource = (source: TaskSessionDocument["actualSecondsSource"]) => {
  if (source === "manual") return "manual";
  if (source === "userEdited") return "edited";

  return "timer";
};

const TimeMap = () => {
  const { user } = useUser();
  const [sessions, setSessions] = useState<TaskSessionDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editedMinutes, setEditedMinutes] = useState("");

  const loadSessions = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setSessions(await fetchTaskSessions(user.id));
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const countedSessions = useMemo(
    () =>
      sessions.filter(
        (session) =>
          !session.excludedFromInsights && session.actualSeconds >= 60,
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

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.contentContainer}
    >
      <View style={styles.panel}>
        <Text style={styles.title}>Time Map</Text>
        <Text style={styles.subtitle}>
          Your private place to notice real patterns, gently.
        </Text>

        {isLoading ? (
          <Text style={styles.statusText}>Loading your time map...</Text>
        ) : sessions.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>
              Your time map is just getting started.
            </Text>
            <Text style={styles.emptyText}>
              Every task you time fills it in a little more.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.summaryBand}>
              <Text style={styles.summaryLabel}>Counted sessions</Text>
              <Text style={styles.summaryValue}>{countedSessions.length}</Text>
              <Text style={styles.summaryHint}>
                {medianSeconds == null
                  ? "We're learning your real numbers so you can stop guessing."
                  : `Typical counted session: ${formatDurationLabel(
                      medianSeconds,
                    )}.`}
              </Text>
              {improvementMessage ? (
                <Text style={styles.winText}>{improvementMessage}</Text>
              ) : null}
            </View>

            <View style={styles.sessionList}>
              {sessions.map((session) => (
                <View key={session._id} style={styles.sessionCard}>
                  <View style={styles.sessionHeader}>
                    <Text style={styles.sessionTitle}>
                      {session.taskTitle || "Untitled task"}
                    </Text>
                    <Text
                      style={[
                        styles.countedPill,
                        session.excludedFromInsights && styles.excludedPill,
                      ]}
                    >
                      {session.excludedFromInsights ? "not counted" : "counted"}
                    </Text>
                  </View>
                  <Text style={styles.sessionMeta}>
                    Felt like{" "}
                    {session.estimatedMinutes == null
                      ? "not set"
                      : `${session.estimatedMinutes} min`}{" "}
                    · ran {formatDurationLabel(session.actualSeconds)} ·{" "}
                    {formatSource(session.actualSecondsSource)}
                  </Text>
                  <Text style={styles.sessionMeta}>
                    Timer saw {formatDurationLabel(session.timerMeasuredSeconds)}
                  </Text>

                  {editingSessionId === session._id ? (
                    <View style={styles.editRow}>
                      <TextInput
                        style={styles.editInput}
                        keyboardType="numeric"
                        placeholder="Actual min"
                        placeholderTextColor="#8f8f8f"
                        value={editedMinutes}
                        onChangeText={setEditedMinutes}
                      />
                      <Pressable
                        style={styles.actionButton}
                        onPress={() => handleSaveEdit(session)}
                      >
                        <Text style={styles.actionButtonText}>Save</Text>
                      </Pressable>
                    </View>
                  ) : null}

                  <View style={styles.actionsRow}>
                    <Pressable
                      style={styles.actionButton}
                      onPress={() => handleStartEdit(session)}
                    >
                      <Text style={styles.actionButtonText}>Edit time</Text>
                    </Pressable>
                    <Pressable
                      style={styles.secondaryButton}
                      onPress={() => handleToggleCounted(session)}
                    >
                      <Text style={styles.actionButtonText}>
                        {session.excludedFromInsights
                          ? "Count this"
                          : "Don't count this one"}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
};

export default TimeMap;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#050505",
  },
  contentContainer: {
    flexGrow: 1,
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 32,
  },
  panel: {
    width: "100%",
    maxWidth: 720,
  },
  title: {
    color: "#f4f4f4",
    fontSize: 30,
    fontWeight: "800",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    color: "#c9c9c9",
    fontSize: 15,
    lineHeight: 21,
    marginBottom: 22,
    textAlign: "center",
  },
  statusText: {
    color: "#c9c9c9",
    fontSize: 16,
    textAlign: "center",
  },
  emptyState: {
    backgroundColor: "#101010",
    borderColor: "#3a3a3a",
    borderRadius: 8,
    borderWidth: 1,
    padding: 18,
  },
  emptyTitle: {
    color: "#f4f4f4",
    fontSize: 19,
    fontWeight: "800",
    marginBottom: 8,
  },
  emptyText: {
    color: "#c9c9c9",
    fontSize: 15,
    lineHeight: 22,
  },
  summaryBand: {
    backgroundColor: "#d8cec3",
    borderRadius: 8,
    gap: 6,
    marginBottom: 18,
    padding: 16,
  },
  summaryLabel: {
    color: "#201f1f",
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  summaryValue: {
    color: "#050505",
    fontSize: 36,
    fontWeight: "900",
  },
  summaryHint: {
    color: "#201f1f",
    fontSize: 15,
    lineHeight: 22,
  },
  winText: {
    color: "#315f30",
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 22,
  },
  sessionList: {
    gap: 12,
  },
  sessionCard: {
    backgroundColor: "#101010",
    borderColor: "#3a3a3a",
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
  },
  sessionHeader: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "space-between",
  },
  sessionTitle: {
    color: "#f4f4f4",
    flex: 1,
    fontSize: 17,
    fontWeight: "800",
    minWidth: 150,
  },
  countedPill: {
    backgroundColor: "#315f30",
    borderRadius: 7,
    color: "#f4f4f4",
    fontSize: 12,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  excludedPill: {
    backgroundColor: "#615d5d",
  },
  sessionMeta: {
    color: "#c9c9c9",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  actionButton: {
    alignItems: "center",
    backgroundColor: "#9ccf9b",
    borderRadius: 7,
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: 12,
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: "#615d5d",
    borderRadius: 7,
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: 12,
  },
  actionButtonText: {
    color: "#050505",
    fontSize: 14,
    fontWeight: "800",
  },
  editRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  editInput: {
    backgroundColor: "#141414",
    borderColor: "#4a4a4a",
    borderRadius: 8,
    borderWidth: 1,
    color: "#f5f5f5",
    minHeight: 40,
    minWidth: 120,
    paddingHorizontal: 12,
  },
});
