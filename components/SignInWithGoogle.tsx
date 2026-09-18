import { design } from "@/constants/design";
import { useAppTheme } from "@/context/AppThemeContext";
import { useSSO } from "@clerk/clerk-expo";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import React, { useCallback, useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

// Preloads the browser for Android devices to reduce authentication load time
// See: https://docs.expo.dev/guides/authentication/#improving-user-experience
export const useWarmUpBrowser = () => {
  useEffect(() => {
    if (Platform.OS !== "android") return;
    void WebBrowser.warmUpAsync();
    return () => {
      // Cleanup: closes browser when component unmounts
      void WebBrowser.coolDownAsync();
    };
  }, []);
};

// Handle any pending authentication sessions
WebBrowser.maybeCompleteAuthSession();

export default function SignInWithGoogle() {
  useWarmUpBrowser();
  const { colors } = useAppTheme();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Use the `useSSO()` hook to access the `startSSOFlow()` method
  const { startSSOFlow } = useSSO();

  const onPress = useCallback(async () => {
    if (isLoading) return;
    setIsLoading(true);
    setErrorMessage("");
    try {
      // Start the authentication process by calling `startSSOFlow()`
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: "oauth_google",
        // For web, defaults to current path
        // For native, you must pass a scheme, like AuthSession.makeRedirectUri({ scheme, path })
        // For more info, see https://docs.expo.dev/versions/latest/sdk/auth-session/#authsessionmakeredirecturioptions
        redirectUrl: AuthSession.makeRedirectUri({}),
      });

      // If sign in was successful, set the active session
      if (createdSessionId) {
        await setActive!({
          session: createdSessionId,
          // Check for session tasks and navigate to custom UI to help users resolve them
          // See https://clerk.com/docs/guides/development/custom-flows/overview#session-tasks
          navigate: async ({ session }) => {
            if (session?.currentTask) {
              console.log(session?.currentTask);
              // No need to navigate to any other page as Protected Route will handle it
              return;
            }
          },
        });
      } else {
        setErrorMessage("Google sign-in wasn't completed. Please try again or sign in with email.");
        // If there is no `createdSessionId`,
        // there are missing requirements, such as MFA
        // See https://clerk.com/docs/guides/development/custom-flows/authentication/oauth-connections#handle-missing-requirements
      }
    } catch {
      // See https://clerk.com/docs/guides/development/custom-flows/error-handling
      // for more info on error handling
      setErrorMessage("Could not sign in with Google. Please try again or sign in with email.");
    } finally {
      setIsLoading(false);
    }
  }, [startSSOFlow, isLoading]);

  return (
    <View>
    <Pressable
      disabled={isLoading}
      accessibilityLabel="Sign in with Google"
      accessibilityRole="button"
      onPress={() => void onPress()}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      <Text accessible={false} style={styles.googleMark}>
        G
      </Text>
      <Text style={[styles.label, { color: colors.text }]}>
        {isLoading ? "Signing in…" : "Continue with Google"}
      </Text>
    </Pressable>
    {errorMessage ? (
      <Text accessibilityLiveRegion="polite" style={{ color: colors.danger, marginTop: design.spacing.sm }}>
        {errorMessage}
      </Text>
    ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    borderRadius: design.radius.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: design.spacing.sm,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: design.spacing.lg,
  },
  googleMark: {
    color: "#4285F4",
    fontSize: 18,
    fontWeight: "800",
  },
  label: {
    fontSize: design.type.body,
    fontWeight: "700",
  },
});
