import { design } from "@/constants/design";
import { ActiveTimerProvider } from "@/context/ActiveTimerContext";
import { AppThemeProvider, useAppTheme } from "@/context/AppThemeContext";
import { useAuth } from "@clerk/clerk-expo";
import { Stack } from "expo-router";
import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Theme } from "tamagui";

function ThemedAppStack({ isSignedIn }: { isSignedIn: boolean }) {
  const { mode } = useAppTheme();

  return (
    <Theme name={mode}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={isSignedIn}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="focus/[taskId]"
            options={{ presentation: "fullScreenModal" }}
          />
        </Stack.Protected>
        <Stack.Protected guard={!isSignedIn}>
          <Stack.Screen name="sign-in" />
          <Stack.Screen name="sign-up" />
        </Stack.Protected>
      </Stack>
    </Theme>
  );
}

export default function AppLayout() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color={design.colors.light.accent} size="large" />
      </View>
    );
  }

  return (
    <AppThemeProvider>
      <ActiveTimerProvider>
        <ThemedAppStack isSignedIn={Boolean(isSignedIn)} />
      </ActiveTimerProvider>
    </AppThemeProvider>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    alignItems: "center",
    backgroundColor: design.colors.light.background,
    flex: 1,
    justifyContent: "center",
  },
});
