import { design } from "@/constants/design";
import { useAppTheme } from "@/context/AppThemeContext";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

export type DayMinutes = {
  label: string;
  minutes: number;
  isToday?: boolean;
};

type WeeklyBarGraphProps = {
  days: DayMinutes[];
};

const GRAPH_HEIGHT = 110;
const MIN_BAR_HEIGHT = 4;

export function WeeklyBarGraph({ days }: WeeklyBarGraphProps) {
  const { colors } = useAppTheme();
  const max = Math.max(1, ...days.map((day) => day.minutes));

  return (
    <View style={styles.container}>
      {days.map((day) => {
        const height = Math.max(
          MIN_BAR_HEIGHT,
          Math.round((day.minutes / max) * GRAPH_HEIGHT),
        );

        return (
          <View key={day.label} style={styles.column}>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.bar,
                  {
                    height,
                    backgroundColor: day.isToday ? colors.barHighlight : colors.barMuted,
                  },
                ]}
              />
            </View>
            <Text
              style={[
                styles.dayLabel,
                { color: day.isToday ? colors.barHighlight : colors.textMuted },
                day.isToday && styles.dayLabelToday,
              ]}
            >
              {day.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: design.spacing.sm,
    height: GRAPH_HEIGHT + 20,
    marginTop: design.spacing.sm + 2,
  },
  column: {
    alignItems: "center",
    flex: 1,
    gap: 5,
    height: "100%",
    justifyContent: "flex-end",
  },
  barTrack: {
    height: GRAPH_HEIGHT,
    justifyContent: "flex-end",
    width: "100%",
  },
  bar: {
    borderTopLeftRadius: design.radius.sm - 2,
    borderTopRightRadius: design.radius.sm - 2,
    width: "100%",
  },
  dayLabel: {
    fontSize: 10.5,
  },
  dayLabelToday: {
    fontWeight: "700",
  },
});
