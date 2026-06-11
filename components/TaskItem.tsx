import { useModal } from "@/context/ModalContext";
import { useTimer } from "@/hooks/use-timer";
import formattime from "@/lib/utils/formattime";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type TaskItemProps = {
  taskId: string;
  onTimeCommitted?: (taskId: string, seconds: number) => void;
  onComplete?: (taskId: string) => void;
};

const TaskItem = ({ taskId, onTimeCommitted, onComplete }: TaskItemProps) => {
  const { elapsedSeconds, isRunning, start, pause, reset } = useTimer(taskId);
  const { showModal } = useModal();

  const handlePause = async () => {
    const committedSeconds = await pause();

    if (committedSeconds !== null) {
      onTimeCommitted?.(taskId, committedSeconds);
    }
  };

  const handleDone = async () => {
    showModal({
      type: "alert",
      title: "Complete task?",
      description: "Are you sure you completed this task?",
      cancelText: "No",
      confirmText: "Yes",
      onConfirm: async () => {
        const committedSeconds = await pause();

        if (committedSeconds !== null) {
          onTimeCommitted?.(taskId, committedSeconds);
        }

        onComplete?.(taskId);
        reset();
      },
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

      <View style={styles.timerActions}>
        {!isRunning ? (
          <Pressable onPress={start} style={styles.timerButton}>
            <Text style={styles.timerButtonText}>Start Timer</Text>
          </Pressable>
        ) : (
          <Pressable onPress={handlePause} style={styles.timerButton}>
            <Text style={styles.timerButtonText}>Pause Timer</Text>
          </Pressable>
        )}
        <Pressable onPress={handleDone} style={styles.doneButton}>
          <Text style={styles.timerButtonText}>Done</Text>
        </Pressable>
        <Pressable onPress={reset} style={styles.secondaryTimerButton}>
          <Text style={styles.timerButtonText}>Reset Timer</Text>
        </Pressable>
      </View>
    </View>
  );
};

export default TaskItem;

const styles = StyleSheet.create({
  timerContainer: {
    backgroundColor: "#615d5d",
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
  timerButtonText: {
    color: "#050505",
    fontSize: 14,
    fontWeight: "800",
  },
});
