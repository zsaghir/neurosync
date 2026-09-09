import { PillButton } from "@/components/ui/PillButton";
import { design } from "@/constants/design";
import { useAppTheme } from "@/context/AppThemeContext";
import {
  createCheckIn,
  recordCheckInOutcome,
  requestCheckInSuggestions,
  type CheckIn,
  type CheckInBasicNeeds,
  type CheckInBlocker,
  type CheckInCapacity,
  type CheckInDifficulty,
  type CheckInHelpfulness,
  type CheckInSleep,
  type CheckInSuggestion,
  type CheckInSuggestionResponse,
} from "@/lib/api/checkins";
import { useAuth } from "@clerk/clerk-expo";
import { useRouter, type Href } from "expo-router";
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

type Phase = "dump" | "context" | "suggestions" | "outcome" | "complete";

type GuidedCheckInProps = {
  mode: "home" | "modal";
  taskId?: string;
  taskTitle?: string;
  onClose?: () => void;
};

const blockers: { description: string; id: CheckInBlocker; title: string }[] = [
  { id: "task_initiation", title: "Starting feels impossible", description: "You know something needs doing, but cannot get into motion." },
  { id: "time_blindness", title: "Time feels unclear", description: "It is hard to judge, begin, or contain how long this needs." },
  { id: "shame", title: "I feel bad about it", description: "Avoidance or falling behind is making it harder to return." },
];

const capacityOptions: { id: CheckInCapacity; label: string }[] = [
  { id: "about_normal", label: "About normal" },
  { id: "lower_than_usual", label: "Lower than usual" },
  { id: "almost_nothing_left", label: "Almost nothing left" },
  { id: "not_sure", label: "Not sure" },
];

const sleepOptions: { id: CheckInSleep; label: string }[] = [
  { id: "restful", label: "Restful" },
  { id: "too_short", label: "Too short" },
  { id: "restless", label: "Restless" },
  { id: "prefer_not_to_say", label: "Skip" },
];

const basicNeedsOptions: { id: CheckInBasicNeeds; label: string }[] = [
  { id: "yes", label: "Yes" },
  { id: "not_really", label: "Not really" },
  { id: "prefer_not_to_say", label: "Skip" },
];

const difficultyOptions: { id: CheckInDifficulty; label: string }[] = [
  { id: "task_too_large", label: "The task feels too large" },
  { id: "first_step_unclear", label: "The first step is unclear" },
  { id: "shame", label: "Shame or self-criticism" },
  { id: "distracted", label: "I keep getting distracted" },
  { id: "time_unclear", label: "The time feels unclear" },
  { id: "too_many_choices", label: "There are too many choices" },
  { id: "low_energy", label: "My energy is low" },
  { id: "emotionally_overwhelmed", label: "I feel emotionally overwhelmed" },
];

export function GuidedCheckIn({ mode, taskId, taskTitle, onClose }: GuidedCheckInProps) {
  const { getToken } = useAuth();
  const router = useRouter();
  const { colors } = useAppTheme();

  const [phase, setPhase] = useState<Phase>("dump");
  const [blocker, setBlocker] = useState<CheckInBlocker | null>(null);
  const [brainDump, setBrainDump] = useState("");
  const [stucknessBefore, setStucknessBefore] = useState<number | null>(null);
  const [capacity, setCapacity] = useState<CheckInCapacity | null>(null);
  const [sleep, setSleep] = useState<CheckInSleep | null>(null);
  const [basicNeeds, setBasicNeeds] = useState<CheckInBasicNeeds | null>(null);
  const [medicationShift, setMedicationShift] = useState<boolean | null>(null);
  const [substanceImpact, setSubstanceImpact] = useState<boolean | null>(null);
  const [difficulties, setDifficulties] = useState<CheckInDifficulty[]>([]);
  const [suggestionResponse, setSuggestionResponse] = useState<CheckInSuggestionResponse | null>(null);
  const [selectedSuggestion, setSelectedSuggestion] = useState<CheckInSuggestion | null>(null);
  const [nextStep, setNextStep] = useState("");
  const [checkIn, setCheckIn] = useState<CheckIn | null>(null);
  const [stucknessAfter, setStucknessAfter] = useState<number | null>(null);
  const [attempted, setAttempted] = useState<boolean | null>(null);
  const [nextStepTaken, setNextStepTaken] = useState<boolean | null>(null);
  const [helpfulness, setHelpfulness] = useState<CheckInHelpfulness | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const improvement = useMemo(() => {
    if (!checkIn || checkIn.stucknessAfter == null) return null;
    return checkIn.stucknessBefore - checkIn.stucknessAfter;
  }, [checkIn]);

  const reset = () => {
    setPhase("dump");
    setBlocker(null);
    setBrainDump("");
    setStucknessBefore(null);
    setCapacity(null);
    setSleep(null);
    setBasicNeeds(null);
    setMedicationShift(null);
    setSubstanceImpact(null);
    setDifficulties([]);
    setSuggestionResponse(null);
    setSelectedSuggestion(null);
    setNextStep("");
    setCheckIn(null);
    setStucknessAfter(null);
    setAttempted(null);
    setNextStepTaken(null);
    setHelpfulness(null);
    setError("");
  };

  const toggleDifficulty = (difficulty: CheckInDifficulty) => {
    setDifficulties((current) =>
      current.includes(difficulty)
        ? current.filter((item) => item !== difficulty)
        : [...current, difficulty],
    );
  };

  const loadSuggestions = async () => {
    if (!blocker || brainDump.trim().length < 10 || stucknessBefore == null) return;

    setIsLoading(true);
    setError("");
    try {
      const response = await requestCheckInSuggestions(getToken, {
        ...(taskId ? { taskId } : {}),
        blocker,
        brainDump: brainDump.trim(),
        ...(capacity ? { capacity } : {}),
        ...(sleep ? { sleep } : {}),
        ...(basicNeeds ? { basicNeeds } : {}),
        ...(medicationShift != null ? { medicationShift } : {}),
        ...(substanceImpact != null ? { substanceImpact } : {}),
        difficulties,
      });
      setSuggestionResponse(response);
      setSelectedSuggestion(null);
      setNextStep("");
      setPhase("suggestions");
    } catch (loadError) {
      console.error("Error requesting check-in suggestions:", loadError);
      setError(loadError instanceof Error ? loadError.message : "Could not create suggestions.");
    } finally {
      setIsLoading(false);
    }
  };

  const chooseSuggestion = (suggestion: CheckInSuggestion) => {
    setSelectedSuggestion(suggestion);
    setNextStep(suggestion.nextStep);
  };

  const openTimer = (created: CheckIn) => {
    setPhase("outcome");

    if (taskId) {
      router.push({
        pathname: "/(app)/focus/[taskId]",
        params: {
          taskId,
          checkInMinutes: String(created.plannedMinutes ?? ""),
          checkInNextStep: created.nextStep ?? "",
        },
      } as unknown as Href);
      return;
    }

    router.push({
      pathname: "/(app)/focus/check-in",
      params: {
        checkInId: created.id,
        checkInMinutes: String(created.plannedMinutes ?? ""),
        checkInNextStep: created.nextStep ?? "",
      },
    } as unknown as Href);
  };

  const saveCheckIn = async (startTimer: boolean) => {
    if (!blocker || stucknessBefore == null || !selectedSuggestion || !nextStep.trim()) return;

    setIsLoading(true);
    setError("");
    try {
      const created = await createCheckIn(getToken, {
        ...(taskId ? { taskId } : {}),
        blocker,
        supportAction: selectedSuggestion.strategy,
        nextStep: nextStep.trim(),
        plannedMinutes: selectedSuggestion.plannedMinutes,
        stucknessBefore,
      });
      setCheckIn(created);
      if (startTimer) {
        openTimer(created);
      } else {
        setPhase("outcome");
      }
    } catch (saveError) {
      console.error("Error creating check-in:", saveError);
      setError(saveError instanceof Error ? saveError.message : "Could not save this check-in.");
    } finally {
      setIsLoading(false);
    }
  };

  const saveOutcome = async () => {
    if (!checkIn || stucknessAfter == null || attempted == null || helpfulness == null) return;
    if (attempted && nextStepTaken == null) return;

    setIsLoading(true);
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
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={[styles.safeArea, { backgroundColor: colors.background }]}>
      {mode === "home" ? (
        <View style={styles.homeHeader}><Text style={[styles.homeTitle, { color: colors.text }]}>Home</Text></View>
      ) : (
        <View style={styles.modalHeader}>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.closeTarget}><Text style={[styles.closeText, { color: colors.textMuted }]}>Close</Text></Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Check in</Text>
          <View style={styles.closeTarget} />
        </View>
      )}

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {taskTitle ? <Text style={[styles.taskContext, { color: colors.textMuted }]}>For {taskTitle}</Text> : null}

        {phase === "dump" ? (
          <DumpPhase
            blocker={blocker}
            brainDump={brainDump}
            stuckness={stucknessBefore}
            onBlocker={setBlocker}
            onBrainDump={setBrainDump}
            onStuckness={setStucknessBefore}
            onContinue={() => setPhase("context")}
          />
        ) : null}

        {phase === "context" ? (
          <>
            <Text style={[styles.title, { color: colors.text }]}>A little context can help</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>These questions are optional. Skip anything you do not want to share.</Text>
            <OptionQuestion title="How is your capacity today?" options={capacityOptions} value={capacity} onChange={setCapacity} />
            <OptionQuestion title="How was your sleep?" options={sleepOptions} value={sleep} onChange={setSleep} />
            <OptionQuestion title="Have you eaten and had water recently?" options={basicNeedsOptions} value={basicNeeds} onChange={setBasicNeeds} />
            <OptionalBinaryQuestion title="Has anything changed from your usual medication routine?" value={medicationShift} onChange={setMedicationShift} />
            <OptionalBinaryQuestion title="Could alcohol or another substance be affecting you today?" value={substanceImpact} onChange={setSubstanceImpact} />
            <QuestionText>What else is making this difficult?</QuestionText>
            <Text style={[styles.helper, { color: colors.textMuted }]}>Choose any that fit.</Text>
            <View style={styles.chipList}>
              {difficultyOptions.map((option) => <SmallChoice key={option.id} label={option.label} selected={difficulties.includes(option.id)} onPress={() => toggleDifficulty(option.id)} />)}
            </View>
            {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
            <PillButton disabled={isLoading} onPress={() => void loadSuggestions()} style={styles.primaryButton}>{isLoading ? <ActivityIndicator color={colors.accentText} /> : "Find a way forward"}</PillButton>
            <PillButton variant="text" onPress={() => setPhase("dump")}>Back</PillButton>
          </>
        ) : null}

        {phase === "suggestions" && suggestionResponse ? (
          <SuggestionsPhase
            response={suggestionResponse}
            selected={selectedSuggestion}
            nextStep={nextStep}
            error={error}
            isLoading={isLoading}
            onSelect={chooseSuggestion}
            onNextStep={setNextStep}
            onStart={() => void saveCheckIn(true)}
            onAlreadyTried={() => void saveCheckIn(false)}
            onBack={() => setPhase("context")}
          />
        ) : null}

        {phase === "outcome" && checkIn ? (
          <OutcomePhase
            stuckness={stucknessAfter}
            attempted={attempted}
            nextStepTaken={nextStepTaken}
            helpfulness={helpfulness}
            error={error}
            isLoading={isLoading}
            onStuckness={setStucknessAfter}
            onAttempted={(value) => {
              setAttempted(value);
              if (!value) {
                setNextStepTaken(null);
                setHelpfulness("not_yet");
              } else if (attempted === false) setHelpfulness(null);
            }}
            onNextStepTaken={setNextStepTaken}
            onHelpfulness={setHelpfulness}
            onSave={() => void saveOutcome()}
          />
        ) : null}

        {phase === "complete" && checkIn ? (
          <View style={styles.completeBlock}>
            <Text style={[styles.eyebrow, { color: colors.accent }]}>Check-in saved</Text>
            <Text style={[styles.title, { color: colors.text }]}>That result counts.</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>You felt {checkIn.stucknessBefore}/10 stuck before and {checkIn.stucknessAfter}/10 afterward.</Text>
            {improvement != null ? <Text style={[styles.result, { color: colors.text }]}>{improvement > 0 ? `${improvement}-point improvement` : improvement === 0 ? "No change this time" : `${Math.abs(improvement)} points more stuck`}</Text> : null}
            <PillButton onPress={mode === "home" ? reset : onClose} style={styles.primaryButton}>{mode === "home" ? "Start another check-in" : "Done"}</PillButton>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function DumpPhase({ blocker, brainDump, stuckness, onBlocker, onBrainDump, onStuckness, onContinue }: { blocker: CheckInBlocker | null; brainDump: string; stuckness: number | null; onBlocker: (value: CheckInBlocker) => void; onBrainDump: (value: string) => void; onStuckness: (value: number) => void; onContinue: () => void }) {
  const { colors } = useAppTheme();
  return (
    <>
      <Text style={[styles.eyebrow, { color: colors.accent }]}>A place to begin</Text>
      <Text style={[styles.title, { color: colors.text }]}>What is taking up space in your head?</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>Dump it here without organizing it. NeuroSync will help find one small next step.</Text>
      <Text style={[styles.fieldLabel, { color: colors.text }]}>Brain dump</Text>
      <TextInput accessibilityLabel="Brain dump" maxLength={2000} multiline onChangeText={onBrainDump} placeholder="Write what is happening, what feels hard, or everything competing for your attention…" placeholderTextColor={colors.textFaint} style={[styles.input, styles.brainDumpInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} textAlignVertical="top" value={brainDump} />
      <Text style={[styles.characterCount, { color: colors.textMuted }]}>{brainDump.length}/2000</Text>
      <QuestionText>What feels closest right now?</QuestionText>
      <View style={styles.optionList}>{blockers.map((option) => <ChoiceCard key={option.id} title={option.title} description={option.description} selected={blocker === option.id} onPress={() => onBlocker(option.id)} />)}</View>
      <QuestionText>How stuck do you feel?</QuestionText>
      <Text style={[styles.helper, { color: colors.textMuted }]}>0 means not stuck; 10 means completely stuck.</Text>
      <NumberScale value={stuckness} onChange={onStuckness} />
      <PillButton disabled={!blocker || brainDump.trim().length < 10 || stuckness == null} onPress={onContinue} style={styles.primaryButton}>Continue</PillButton>
    </>
  );
}

function SuggestionsPhase({ response, selected, nextStep, error, isLoading, onSelect, onNextStep, onStart, onAlreadyTried, onBack }: { response: CheckInSuggestionResponse; selected: CheckInSuggestion | null; nextStep: string; error: string; isLoading: boolean; onSelect: (value: CheckInSuggestion) => void; onNextStep: (value: string) => void; onStart: () => void; onAlreadyTried: () => void; onBack: () => void }) {
  const { colors } = useAppTheme();
  return (
    <>
      <Text style={[styles.eyebrow, { color: colors.accent }]}>Three ways forward</Text>
      <Text style={[styles.title, { color: colors.text }]}>{response.reassurance}</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>{response.observation}</Text>
      {response.medicalNote ? <View style={[styles.note, { backgroundColor: colors.accentSoft }]}><Text style={[styles.noteText, { color: colors.accentSoftText }]}>{response.medicalNote}</Text></View> : null}
      <View style={styles.optionList}>{response.suggestions.map((suggestion) => <SuggestionCard key={suggestion.strategy} suggestion={suggestion} selected={selected?.strategy === suggestion.strategy} onPress={() => onSelect(suggestion)} />)}</View>
      {selected ? (
        <>
          <Text style={[styles.fieldLabel, { color: colors.text }]}>Your next step</Text>
          <TextInput maxLength={280} multiline onChangeText={onNextStep} style={[styles.input, styles.nextStepInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} textAlignVertical="top" value={nextStep} />
          <Text style={[styles.helper, { color: colors.textMuted }]}>{selected.plannedMinutes}-minute experiment</Text>
        </>
      ) : null}
      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
      <PillButton disabled={!selected || !nextStep.trim() || isLoading} onPress={onStart} style={styles.primaryButton}>{isLoading ? <ActivityIndicator color={colors.accentText} /> : "Use this step"}</PillButton>
      <PillButton disabled={!selected || !nextStep.trim() || isLoading} variant="secondary" onPress={onAlreadyTried} style={styles.secondaryButton}>I already tried it</PillButton>
      <PillButton variant="text" onPress={onBack}>Back</PillButton>
    </>
  );
}

function OutcomePhase({ stuckness, attempted, nextStepTaken, helpfulness, error, isLoading, onStuckness, onAttempted, onNextStepTaken, onHelpfulness, onSave }: { stuckness: number | null; attempted: boolean | null; nextStepTaken: boolean | null; helpfulness: CheckInHelpfulness | null; error: string; isLoading: boolean; onStuckness: (value: number) => void; onAttempted: (value: boolean) => void; onNextStepTaken: (value: boolean) => void; onHelpfulness: (value: CheckInHelpfulness) => void; onSave: () => void }) {
  const { colors } = useAppTheme();
  return (
    <>
      <Text style={[styles.title, { color: colors.text }]}>How did it go?</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>A quick follow-up helps NeuroSync learn from what actually happened.</Text>
      <QuestionText>How stuck do you feel now?</QuestionText>
      <NumberScale value={stuckness} onChange={onStuckness} />
      <BinaryQuestion title="Did you try the support action?" value={attempted} onChange={onAttempted} />
      {attempted ? <BinaryQuestion title="Did you take the next step?" value={nextStepTaken} onChange={onNextStepTaken} /> : null}
      {attempted ? (
        <><QuestionText>Did it help?</QuestionText><View style={styles.chipList}>{([ ["yes", "Yes"], ["a_little", "A little"], ["not_yet", "Not yet"] ] as const).map(([value, label]) => <SmallChoice key={value} label={label} selected={helpfulness === value} onPress={() => onHelpfulness(value)} />)}</View></>
      ) : attempted === false ? <Text style={[styles.subtitle, { color: colors.textMuted }]}>That is okay. This attempt will not be counted as a failure.</Text> : null}
      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
      <PillButton disabled={stuckness == null || attempted == null || (attempted && nextStepTaken == null) || helpfulness == null || isLoading} onPress={onSave} style={styles.primaryButton}>{isLoading ? <ActivityIndicator color={colors.accentText} /> : "Save follow-up"}</PillButton>
    </>
  );
}

function OptionQuestion<Option extends string>({ title, options, value, onChange }: { title: string; options: { id: Option; label: string }[]; value: Option | null; onChange: (value: Option) => void }) {
  return <View><QuestionText>{title}</QuestionText><View style={styles.chipList}>{options.map((option) => <SmallChoice key={option.id} label={option.label} selected={value === option.id} onPress={() => onChange(option.id)} />)}</View></View>;
}

function OptionalBinaryQuestion({ title, value, onChange }: { title: string; value: boolean | null; onChange: (value: boolean | null) => void }) {
  return <View><QuestionText>{title}</QuestionText><View style={styles.chipList}><SmallChoice label="Yes" selected={value === true} onPress={() => onChange(true)} /><SmallChoice label="No" selected={value === false} onPress={() => onChange(false)} /><SmallChoice label="Skip" selected={value === null} onPress={() => onChange(null)} /></View></View>;
}

function BinaryQuestion({ title, value, onChange }: { title: string; value: boolean | null; onChange: (value: boolean) => void }) {
  return <View><QuestionText>{title}</QuestionText><View style={styles.chipList}><SmallChoice label="Yes" selected={value === true} onPress={() => onChange(true)} /><SmallChoice label="No" selected={value === false} onPress={() => onChange(false)} /></View></View>;
}

function QuestionText({ children }: { children: React.ReactNode }) {
  const { colors } = useAppTheme();
  return <Text style={[styles.question, { color: colors.text }]}>{children}</Text>;
}

function SuggestionCard({ suggestion, selected, onPress }: { suggestion: CheckInSuggestion; selected: boolean; onPress: () => void }) {
  const { colors } = useAppTheme();
  return <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={onPress} style={[styles.choiceCard, { backgroundColor: selected ? colors.accentSoft : colors.surface, borderColor: selected ? colors.accent : colors.border }]}><View style={styles.suggestionHeader}><Text style={[styles.choiceTitle, { color: colors.text }]}>{suggestion.title}</Text><Text style={[styles.minutes, { color: colors.accent }]}>{suggestion.plannedMinutes} min</Text></View><Text style={[styles.suggestionStep, { color: colors.text }]}>{suggestion.nextStep}</Text><Text style={[styles.choiceDescription, { color: colors.textMuted }]}>{suggestion.why}</Text></Pressable>;
}

function ChoiceCard({ title, description, selected, onPress }: { title: string; description: string; selected: boolean; onPress: () => void }) {
  const { colors } = useAppTheme();
  return <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={onPress} style={[styles.choiceCard, { backgroundColor: selected ? colors.accentSoft : colors.surface, borderColor: selected ? colors.accent : colors.border }]}><Text style={[styles.choiceTitle, { color: colors.text }]}>{title}</Text><Text style={[styles.choiceDescription, { color: colors.textMuted }]}>{description}</Text></Pressable>;
}

function NumberScale({ value, onChange }: { value: number | null; onChange: (value: number) => void }) {
  return <View style={styles.numberScale}>{Array.from({ length: 11 }, (_, number) => <SmallChoice key={number} label={String(number)} selected={value === number} onPress={() => onChange(number)} compact />)}</View>;
}

function SmallChoice({ label, selected, onPress, compact = false }: { label: string; selected: boolean; onPress: () => void; compact?: boolean }) {
  const { colors } = useAppTheme();
  return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected }} onPress={onPress} style={[styles.smallChoice, compact && styles.compactChoice, { backgroundColor: selected ? colors.accent : colors.surface, borderColor: selected ? colors.accent : colors.border }]}><Text style={[styles.smallChoiceText, { color: selected ? colors.accentText : colors.text }]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  homeHeader: { alignSelf: "center", maxWidth: design.contentMaxWidth, paddingHorizontal: design.spacing.lg, paddingTop: design.spacing.md, width: "100%" },
  homeTitle: { fontSize: design.type.screenTitle, fontWeight: "800" },
  modalHeader: { alignItems: "center", flexDirection: "row", height: 52, justifyContent: "space-between", paddingHorizontal: design.spacing.lg },
  closeTarget: { justifyContent: "center", minHeight: design.touchTarget, width: 64 },
  closeText: { fontSize: design.type.meta + 1 },
  headerTitle: { fontSize: design.type.body, fontWeight: "700" },
  content: { alignSelf: "center", maxWidth: design.contentMaxWidth, paddingBottom: design.spacing.huge * 2, paddingHorizontal: design.spacing.lg, paddingTop: design.spacing.lg, width: "100%" },
  taskContext: { fontSize: design.type.meta, marginBottom: design.spacing.sm },
  eyebrow: { fontSize: design.type.sectionLabel, fontWeight: "800", letterSpacing: design.letterSpacing.sectionLabel, textTransform: "uppercase" },
  title: { fontSize: design.type.screenTitle, fontWeight: "800", lineHeight: 34, marginTop: design.spacing.xs },
  subtitle: { fontSize: design.type.body, lineHeight: 22, marginTop: design.spacing.xs },
  fieldLabel: { fontSize: design.type.body, fontWeight: "700", marginBottom: design.spacing.xs, marginTop: design.spacing.xl },
  input: { borderRadius: design.radius.md, borderWidth: 1, fontSize: design.type.body, minHeight: design.touchTarget, paddingHorizontal: design.spacing.md, paddingVertical: design.spacing.md },
  brainDumpInput: { minHeight: 150 },
  nextStepInput: { minHeight: 90 },
  characterCount: { alignSelf: "flex-end", fontSize: design.type.caption, marginTop: design.spacing.xxs },
  question: { fontSize: design.type.body, fontWeight: "700", marginTop: design.spacing.xl },
  helper: { fontSize: design.type.meta, lineHeight: 18, marginTop: design.spacing.xxs },
  optionList: { gap: design.spacing.sm, marginTop: design.spacing.md },
  choiceCard: { borderRadius: design.radius.lg, borderWidth: 1, padding: design.spacing.md },
  choiceTitle: { flex: 1, fontSize: design.type.body + 1, fontWeight: "700" },
  choiceDescription: { fontSize: design.type.meta + 1, lineHeight: 19, marginTop: design.spacing.xs },
  numberScale: { flexDirection: "row", flexWrap: "wrap", gap: design.spacing.xs, marginTop: design.spacing.sm },
  chipList: { flexDirection: "row", flexWrap: "wrap", gap: design.spacing.xs, marginTop: design.spacing.sm },
  smallChoice: { alignItems: "center", borderRadius: design.radius.pill, borderWidth: 1, justifyContent: "center", minHeight: design.touchTarget, paddingHorizontal: design.spacing.md },
  compactChoice: { minWidth: 44, paddingHorizontal: design.spacing.xs },
  smallChoiceText: { fontSize: design.type.meta + 1, fontWeight: "700" },
  primaryButton: { marginTop: design.spacing.xl },
  secondaryButton: { marginTop: design.spacing.sm },
  error: { fontSize: design.type.meta, marginTop: design.spacing.md },
  note: { borderRadius: design.radius.md, marginTop: design.spacing.md, padding: design.spacing.md },
  noteText: { fontSize: design.type.meta + 1, lineHeight: 20 },
  suggestionHeader: { alignItems: "center", flexDirection: "row", gap: design.spacing.sm, justifyContent: "space-between" },
  suggestionStep: { fontSize: design.type.body, fontWeight: "600", lineHeight: 21, marginTop: design.spacing.sm },
  minutes: { fontSize: design.type.meta, fontWeight: "800" },
  completeBlock: { paddingTop: design.spacing.xxl },
  result: { fontSize: design.type.cardTitle, fontWeight: "700", marginTop: design.spacing.xl },
});
