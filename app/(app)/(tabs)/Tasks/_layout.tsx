import { useAppTheme } from "@/context/AppThemeContext";
import { Stack } from "expo-router";
import React from "react";

export default function TasksStackLayout() {
  const { colors } = useAppTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
