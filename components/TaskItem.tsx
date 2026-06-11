import { useTimer } from "@/hooks/use-timer";
import formattime from "@/lib/utils/formattime";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

const TaskItem = ({ taskId }: { taskId: string }) => {
  const { elapsedSeconds, isRunning, start, pause, reset } = useTimer(taskId);
  return (
    <View>
      <Text style={styles.elapsedTime}>{formattime(elapsedSeconds)}</Text>
      {!isRunning ? (
        <Text onPress={start} style={{ marginTop: 20, fontSize: 18 }}>
          Start Timer
        </Text>
      ) : (
        <Text onPress={pause} style={{ marginTop: 20, fontSize: 18 }}>
          Pause Timer
        </Text>
      )}
      <Text onPress={reset} style={{ marginTop: 20, fontSize: 18 }}>
        Reset Timer
      </Text>
    </View>
  );
};

export default TaskItem;

const styles = StyleSheet.create({
  elapsedTime: {
    fontSize: 24,
    fontWeight: "bold",
    marginTop: 16,
  },
});
