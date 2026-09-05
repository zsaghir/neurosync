import { PillButton } from "@/components/ui/PillButton";
import { design } from "@/constants/design";
import { useAppTheme } from "@/context/AppThemeContext";
import {
  createCheckIn,
  recordCheckInOutcome,
  type CheckIn,
  type CheckInBlocker,
  type CheckInHelpfulness,
} from "@/lib/api/checkins";
import { useAuth } from "@clerk/clerk-expo";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import React, { useMemo, useState } from "react";
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

type Phase = "blocker" | "support" | "ready" | "outcome" | "complete";

type SupportOption = {
  description: string;
  id: string;
  minutes: number;
  nextStep: string;
  title: string;
};

const blockers: {
  description: string;
  id: CheckInBlocker;
  title: string;
}[] = [
  {
    id: "task_initiation",
    title: "Starting feels impossible",
    description: "You know what to do, but cannot get into motion.",
  },
  {
    id: "time_blindness",
    title: "Time feels unclear",
    description: "It is hard to judge, begin, or contain the time this needs.",
  },
  {
    id: "shame",
    title: "I feel bad about it",
    description: "Avoidance or falling behind is making it harder to return.",
  },
];

const supportOptions: Record<CheckInBlocker, SupportOption[]> = {
  task_initiation: [
    {
      id: "tiny_first_step",
      title: "Make the first step tiny",
      description: "Do one physical action that makes the task easier to enter.",
      minutes: 5,
      nextStep: "Open what you need and do the first visible action.",
    },
    {
      id: "five_minute_start",
      title: "Try five minutes",
      description: "You only need to begin. Continuing is optional.",
      minutes: 5,
      nextStep: "Work on the smallest part for five minutes.",
    },
  ],
  time_blindness: [
    {
      id: "visible_time_box",
      title: "Make ten minutes visible",
      description: "Use a short, bounded session instead of estimating the whole task.",
      minutes: 10,
      nextStep: "Choose one part and work on it until the timer ends.",
    },
    {
      id: "estimate_one_step",
      title: "Estimate only one step",
      description: "Shrink the time decision to the next action, not the entire task.",
      minutes: 15,
      nextStep: "Name one step that can fit inside fifteen minutes.",
    },
  ],
  shame: [
    {
      id: "gentle_restart",
      title: "Restart without catching up",
      description: "Return from where you are instead of repairing everything at once.",
      minutes: 5,
      nextStep: "Look at where you stopped and make one small change.",
    },
    {
      id: "lower_the_bar",
      title: "Lower the bar for today",
      description: "Choose a version small enough to complete with your current capacity.",
      minutes: 5,
      nextStep: "Do the smallest useful version of this task.",
    },
  ],
};

export default function CheckInScreen() {
  const params = useLocalSearchParams<{ taskId?: string; taskTitle?: string }>();
  const taskId = typeof params.taskId === "string" ? params.taskId : undefined;
  const taskTitle = typeof params.taskTitle === "string" ? params.taskTitle : undefined;
  const { getToken } = useAuth();
  const router = useRouter();
  const { colors } = useAppTheme();

  const [phase, setPhase] = useState<Phase>("blocker");
  const [blocker, setBlocker] = useState<CheckInBlocker | null>(null);
  const [reason, setReason] = useState("");
  const [stucknessBefore, setStucknessBefore] = useState<number | null>(null);
  const [selectedSupport, setSelectedSupport] = useState<SupportOption | null>(null);
  const [nextStep, setNextStep] = useState("");
  const [checkIn, setCheckIn] = useState<CheckIn | null>(null);
  const [stucknessAfter, setStucknessAfter] = useState<number | null>(null);
  const [attempted, setAttempted] = useState<boolean | null>(null);
  const [nextStepTaken, setNextStepTaken] = useState<boolean | null>(null);
  const [helpfulness, setHelpfulness] = useState<CheckInHelpfulness | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const improvement = useMemo(() => {
    if (!checkIn || checkIn.stucknessAfter == null) return null;
    return checkIn.stucknessBefore - checkIn.stucknessAfter;
  }, [checkIn]);

  const chooseSupport = (option: SupportOption) => {
    setSelectedSupport(option);
    setNextStep(option.nextStep);
  };

  const saveCheckIn = async () => {
    if (!blocker || stucknessBefore == null || !selectedSupport || !nextStep.trim()) {
      return;
    }

    setIsSaving(true);
    setError("");
    try {
      const created = await createCheckIn(getToken, {
        ...(taskId ? { taskId } : {}),
        blocker,
        ...(reason.trim() ? { reason: reason.trim() } : {}),
        supportAction: selectedSupport.id,
        nextStep: nextStep.trim(),
        plannedMinutes: selectedSupport.minutes,
        stucknessBefore,
      });
      setCheckIn(created);
      setPhase("ready");
    } catch (saveError) {
      console.error("Error creating check-in:", saveError);
      setError(saveError instanceof Error ? saveError.message : "Could not save this check-in.");
    } finally {
      setIsSaving(false);
    }
  };

  const startFocus = () => {
    if (!taskId) {
      setPhase("outcome");
      return;
    }
    setPhase("outcome");
    router.push({
      pathname: "/(app)/focus/[taskId]",
      params: {
        taskId,
        checkInMinutes: String(checkIn?.plannedMinutes ?? ""),
        checkInNextStep: checkIn?.nextStep ?? "",
      },
    } as unknown as Href);
  };

  const saveOutcome = async () => {
    if (!checkIn || stucknessAfter == null || attempted == null || helpfulness == null) {
      return;
    }
    if (attempted && nextStepTaken == null) return;

    setIsSaving(true);
    setError("");
    try {
      const updated = await recordCheckInOutcome(getToken, checkIn.id, {
        stucknessAfter,
        interventionAttempted: attempted,
        ...(attempted && nextStepTaken != null ? { nextStepTaken } : {}),
        helpfulness,
      });
      setCheckIn(updated);
      setPhase("complete");
    } catch (saveError) {
      console.error("Error recording check-in outcome:", saveError);
      setError(saveError instanceof Error ? saveError.message : "Could not save the follow-up.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.closeTarget}>
          <Text style={[styles.closeText, { color: colors.textMuted }]}>Close</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Check in</Text>
        <View style={styles.closeTarget} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {taskTitle ? (
          <Text style={[styles.taskContext, { color: colors.textMuted }]}>For {taskTitle}</Text>
        ) : null}

        {phase === "blocker" ? (
          <>
            <Text style={[styles.title, { color: colors.text }]}>What is holding you back?</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>Choose what feels closest right now.</Text>

            <View style={styles.optionList}>
              {blockers.map((option) => (
                <ChoiceCard
                  key={option.id}
                  title={option.title}
                  description={option.description}
                  selected={blocker === option.id}
                  onPress={() => {
                    setBlocker(option.id);
                    setSelectedSupport(null);
                    setNextStep("");
                  }}
                />
              ))}
            </View>

            <Text style={[styles.question, { color: colors.text }]}>How stuck do you feel?</Text>
            <NumberScale value={stucknessBefore} onChange={setStucknessBefore} />

            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Anything making it harder? Optional</Text>
            <TextInput
              maxLength={64}
              onChangeText={setReason}
              placeholder="A short reason"
              placeholderTextColor={colors.textFaint}
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              value={reason}
            />

            <PillButton
              disabled={!blocker || stucknessBefore == null}
              onPress={() => setPhase("support")}
              style={styles.primaryButton}
            >
              Continue
            </PillButton>
          </>
        ) : null}

        {phase === "support" && blocker ? (
          <>
            <Text style={[styles.title, { color: colors.text }]}>What would help you move?</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>Pick one small experiment. You can edit the exact step.</Text>

            <View style={styles.optionList}>
              {supportOptions[blocker].map((option) => (
                <ChoiceCard
                  key={option.id}
                  title={option.title}
                  description={option.description}
                  selected={selectedSupport?.id === option.id}
                  onPress={() => chooseSupport(option)}
                />
              ))}
            </View>

            {selectedSupport ? (
              <>
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Your next step</Text>
                <TextInput
                  maxLength={280}
                  multiline
                  onChangeText={setNextStep}
                  placeholder="One concrete next action"
                  placeholderTextColor={colors.textFaint}
                  style={[styles.input, styles.nextStepInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                  value={nextStep}
                />
                <Text style={[styles.minuteNote, { color: colors.textMuted }]}>{selectedSupport.minutes}-minute experiment</Text>
              </>
            ) : null}

            {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
            <PillButton
              disabled={!selectedSupport || !nextStep.trim() || isSaving}
              onPress={() => void saveCheckIn()}
              style={styles.primaryButton}
            >
              {isSaving ? <ActivityIndicator color={colors.accentText} /> : "Use this step"}
            </PillButton>
            <PillButton variant="text" onPress={() => setPhase("blocker")}>Back</PillButton>
          </>
        ) : null}

        {phase === "ready" && checkIn ? (
          <>
            <Text style={[styles.eyebrow, { color: colors.accent }]}>Your next step</Text>
            <Text style={[styles.actionText, { color: colors.text }]}>{checkIn.nextStep}</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>Try it for {checkIn.plannedMinutes} minutes. The goal is information, not perfection.</Text>

            {taskId ? (
              <PillButton onPress={startFocus} style={styles.primaryButton}>Start focus</PillButton>
            ) : (
              <PillButton onPress={() => setPhase("outcome")} style={styles.primaryButton}>I’ll try it now</PillButton>
            )}
            <PillButton variant="secondary" onPress={() => setPhase("outcome")} style={styles.secondaryButton}>I already tried it</PillButton>
          </>
        ) : null}

        {phase === "outcome" && checkIn ? (
          <>
            <Text style={[styles.title, { color: colors.text }]}>How did it go?</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>A quick follow-up helps NeuroSync learn from what actually happened.</Text>

            <Text style={[styles.question, { color: colors.text }]}>How stuck do you feel now?</Text>
            <NumberScale value={stucknessAfter} onChange={setStucknessAfter} />

            <BinaryQuestion label="Did you try the support action?" value={attempted} onChange={(value) => {
              setAttempted(value);
              if (!value) {
                setNextStepTaken(null);
                setHelpfulness("not_yet");
              } else if (attempted === false) {
                setHelpfulness(null);
              }
            }} />

            {attempted ? (
              <BinaryQuestion label="Did you take the next step?" value={nextStepTaken} onChange={setNextStepTaken} />
            ) : null}

            {attempted ? (
              <>
                <Text style={[styles.question, { color: colors.text }]}>Did it help?</Text>
                <View style={styles.segmentRow}>
                  {([
                    ["yes", "Yes"],
                    ["a_little", "A little"],
                    ["not_yet", "Not yet"],
                  ] as const).map(([value, label]) => (
                    <SmallChoice key={value} label={label} selected={helpfulness === value} onPress={() => setHelpfulness(value)} />
                  ))}
                </View>
              </>
            ) : attempted === false ? (
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>That is okay. This attempt will not be counted as a failure.</Text>
            ) : null}

            {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
            <PillButton
              disabled={stucknessAfter == null || attempted == null || (attempted && nextStepTaken == null) || helpfulness == null || isSaving}
              onPress={() => void saveOutcome()}
              style={styles.primaryButton}
            >
              {isSaving ? <ActivityIndicator color={colors.accentText} /> : "Save follow-up"}
            </PillButton>
          </>
        ) : null}

        {phase === "complete" && checkIn ? (
          <View style={styles.completeBlock}>
            <Text style={[styles.eyebrow, { color: colors.accent }]}>Check-in saved</Text>
            <Text style={[styles.title, { color: colors.text }]}>That result counts.</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>You felt {checkIn.stucknessBefore}/10 stuck before and {checkIn.stucknessAfter}/10 afterward.</Text>
            {improvement != null ? (
              <Text style={[styles.result, { color: colors.text }]}>
                {improvement > 0
                  ? `${improvement}-point improvement`
                  : improvement === 0
                    ? "No change this time"
                    : `${Math.abs(improvement)} points more stuck`}
              </Text>
            ) : null}
            <PillButton onPress={() => router.back()} style={styles.primaryButton}>Done</PillButton>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function ChoiceCard({ title, description, selected, onPress }: { title: string; description: string; selected: boolean; onPress: () => void }) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={[styles.choiceCard, { backgroundColor: selected ? colors.accentSoft : colors.surface, borderColor: selected ? colors.accent : colors.border }]}
    >
      <Text style={[styles.choiceTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.choiceDescription, { color: colors.textMuted }]}>{description}</Text>
    </Pressable>
  );
}

function NumberScale({ value, onChange }: { value: number | null; onChange: (value: number) => void }) {
  return (
    <View style={styles.numberScale}>
      {Array.from({ length: 11 }, (_, number) => (
        <SmallChoice key={number} label={String(number)} selected={value === number} onPress={() => onChange(number)} compact />
      ))}
    </View>
  );
}

function BinaryQuestion({ label, value, onChange }: { label: string; value: boolean | null; onChange: (value: boolean) => void }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.binaryBlock}>
      <Text style={[styles.question, { color: colors.text }]}>{label}</Text>
      <View style={styles.segmentRow}>
        <SmallChoice label="Yes" selected={value === true} onPress={() => onChange(true)} />
        <SmallChoice label="No" selected={value === false} onPress={() => onChange(false)} />
      </View>
    </View>
  );
}

function SmallChoice({ label, selected, onPress, compact = false }: { label: string; selected: boolean; onPress: () => void; compact?: boolean }) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={[styles.smallChoice, compact && styles.compactChoice, { backgroundColor: selected ? colors.accent : colors.surface, borderColor: selected ? colors.accent : colors.border }]}
    >
      <Text style={[styles.smallChoiceText, { color: selected ? colors.accentText : colors.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: { alignItems: "center", flexDirection: "row", height: 52, justifyContent: "space-between", paddingHorizontal: design.spacing.lg },
  closeTarget: { justifyContent: "center", minHeight: design.touchTarget, width: 64 },
  closeText: { fontSize: design.type.meta + 1 },
  headerTitle: { fontSize: design.type.body, fontWeight: "700" },
  content: { alignSelf: "center", maxWidth: design.contentMaxWidth, paddingBottom: design.spacing.huge, paddingHorizontal: design.spacing.lg, paddingTop: design.spacing.lg, width: "100%" },
  taskContext: { fontSize: design.type.meta, marginBottom: design.spacing.sm },
  title: { fontSize: design.type.screenTitle, fontWeight: "800", lineHeight: 32 },
  subtitle: { fontSize: design.type.body, lineHeight: 22, marginTop: design.spacing.xs },
  optionList: { gap: design.spacing.sm, marginTop: design.spacing.lg },
  choiceCard: { borderRadius: design.radius.lg, borderWidth: 1, padding: design.spacing.md },
  choiceTitle: { fontSize: design.type.body + 1, fontWeight: "700" },
  choiceDescription: { fontSize: design.type.meta + 1, lineHeight: 19, marginTop: design.spacing.xxs },
  question: { fontSize: design.type.body, fontWeight: "700", marginTop: design.spacing.xl },
  numberScale: { flexDirection: "row", flexWrap: "wrap", gap: design.spacing.xs, marginTop: design.spacing.sm },
  smallChoice: { alignItems: "center", borderRadius: design.radius.pill, borderWidth: 1, justifyContent: "center", minHeight: design.touchTarget, minWidth: 88, paddingHorizontal: design.spacing.md },
  compactChoice: { minWidth: 44, paddingHorizontal: design.spacing.xs },
  smallChoiceText: { fontSize: design.type.meta + 1, fontWeight: "700" },
  fieldLabel: { fontSize: design.type.meta, fontWeight: "700", marginBottom: design.spacing.xs, marginTop: design.spacing.xl },
  input: { borderRadius: design.radius.md, borderWidth: 1, fontSize: design.type.body, minHeight: design.touchTarget, paddingHorizontal: design.spacing.sm, paddingVertical: design.spacing.sm },
  nextStepInput: { minHeight: 90, textAlignVertical: "top" },
  minuteNote: { fontSize: design.type.meta, marginTop: design.spacing.xs },
  primaryButton: { marginTop: design.spacing.xl },
  secondaryButton: { marginTop: design.spacing.sm },
  error: { fontSize: design.type.meta, marginTop: design.spacing.md },
  eyebrow: { fontSize: design.type.sectionLabel, fontWeight: "800", letterSpacing: design.letterSpacing.sectionLabel, textTransform: "uppercase" },
  actionText: { fontSize: design.type.screenTitle + 2, fontWeight: "800", lineHeight: 36, marginTop: design.spacing.md },
  binaryBlock: { marginTop: design.spacing.sm },
  segmentRow: { flexDirection: "row", flexWrap: "wrap", gap: design.spacing.sm, marginTop: design.spacing.sm },
  completeBlock: { paddingTop: design.spacing.xxl },
  result: { fontSize: design.type.cardTitle, fontWeight: "700", marginTop: design.spacing.xl },
});
