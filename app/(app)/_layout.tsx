import { design } from "@/constants/design";
import { ActiveTimerProvider } from "@/context/ActiveTimerContext";
import { AppThemeProvider, useAppTheme } from "@/context/AppThemeContext";
import { useAuth } from "@clerk/clerk-expo";
import { Stack } from "expo-router";
import React, { useRef } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Theme } from "tamagui";

function LoadingScreen() {
  return (
    <View style={styles.loadingScreen}>
      <ActivityIndicator color={design.colors.light.accent} size="large" />
    </View>
  );
}

function ThemedAppStack({ isSignedIn }: { isSignedIn: boolean }) {
  const { mode, isThemeResolved } = useAppTheme();
  const hasShownApp = useRef(false);

  // On a cold start, wait for the saved theme so the first frame is already
  // the right theme instead of flashing light -> dark. After the app has been
  // shown once (for example after signing in), never unmount the navigator.
  if (!hasShownApp.current && isSignedIn && !isThemeResolved) {
    return <LoadingScreen />;
  }
  hasShownApp.current = true;

  return (
    <Theme name={mode}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={isSignedIn}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="check-in"
            options={{ presentation: "modal" }}
          />
          <Stack.Screen
            name="focus/check-in"
            options={{ presentation: "fullScreenModal" }}
          />
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
    return <LoadingScreen />;
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
