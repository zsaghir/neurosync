import SignInWithGoogle from "@/components/SignInWithGoogle";
import { AppCard, AppScreen } from "@/components/ui/design-system";
import { design } from "@/constants/design";
import { useAppTheme } from "@/context/AppThemeContext";
import { isClerkAPIResponseError, useSignIn } from "@clerk/clerk-expo";
import { ClerkAPIResponseError } from "@clerk/types";
import { Link, useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

export default function SignInScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const { colors } = useAppTheme();
  const router = useRouter();

  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const onSignInPress = async () => {
    if (!isLoaded) return;
    setIsLoading(true);
    setErrorMessage("");

    try {
      const signInAttempt = await signIn.create({
        identifier: emailAddress,
        password,
      });

      if (signInAttempt.status === "complete") {
        await setActive({ session: signInAttempt.createdSessionId });
        router.replace("/");
      } else {
        console.error(JSON.stringify(signInAttempt, null, 2));
      }
    } catch (err) {
      const clerkError = isClerkAPIResponseError(err)
        ? (err as ClerkAPIResponseError)
        : null;

      setErrorMessage(
        clerkError?.errors[0]?.longMessage ||
          clerkError?.errors[0]?.message ||
          "Whoops an error occurred, please try again!",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const disabled = !isLoaded || isLoading;

  return (
    <AppScreen contentContainerStyle={styles.screen}>
      <View style={styles.header}>
        <Text style={[styles.eyebrow, { color: colors.accent }]}>NEUROSYNC</Text>
        <Text style={[styles.title, { color: colors.text }]}>Welcome back</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          Sign in to continue with the support that works for you.
        </Text>
      </View>

      <AppCard style={styles.card}>
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.text }]}>Email address</Text>
          <TextInput
            accessibilityLabel="Email address"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            onChangeText={setEmailAddress}
            placeholder="you@example.com"
            placeholderTextColor={colors.textFaint}
            returnKeyType="next"
            style={[
              styles.input,
              {
                backgroundColor: colors.surfaceMuted,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
            value={emailAddress}
          />
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.text }]}>Password</Text>
          <TextInput
            accessibilityLabel="Password"
            autoComplete="current-password"
            onChangeText={setPassword}
            onSubmitEditing={() => void onSignInPress()}
            placeholder="Enter your password"
            placeholderTextColor={colors.textFaint}
            returnKeyType="done"
            secureTextEntry
            style={[
              styles.input,
              {
                backgroundColor: colors.surfaceMuted,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
            value={password}
          />
        </View>

        {errorMessage ? (
          <View
            accessibilityLiveRegion="polite"
            style={[styles.error, { backgroundColor: colors.dangerSoft }]}
          >
            <Text style={[styles.errorText, { color: colors.danger }]}>
              {errorMessage}
            </Text>
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          disabled={disabled}
          onPress={() => void onSignInPress()}
          style={({ pressed }) => [
            styles.primaryButton,
            {
              backgroundColor: pressed
                ? colors.accentPressed
                : colors.accent,
              opacity: disabled ? 0.55 : 1,
            },
          ]}
        >
          <Text
            style={[styles.primaryButtonText, { color: colors.accentText }]}
          >
            {isLoading ? "Signing in…" : "Sign in"}
          </Text>
        </Pressable>

        <View style={styles.dividerRow}>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Text style={[styles.dividerText, { color: colors.textMuted }]}>or</Text>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
        </View>

        <SignInWithGoogle />
      </AppCard>

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: colors.textMuted }]}>
          New to NeuroSync?
        </Text>
        <Link href="/sign-up" asChild>
          <Pressable accessibilityRole="link" style={styles.textButton}>
            <Text style={[styles.textButtonText, { color: colors.accent }]}>
              Create an account
            </Text>
          </Pressable>
        </Link>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screen: {
    gap: design.spacing.xl,
    justifyContent: "center",
    paddingBottom: design.spacing.xxxl,
    paddingTop: design.spacing.xxxl,
  },
  header: {
    alignItems: "center",
    gap: design.spacing.xs,
  },
  eyebrow: {
    fontSize: design.type.sectionLabel,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  title: {
    fontSize: design.type.screenTitle,
    fontWeight: "800",
    textAlign: "center",
  },
  subtitle: {
    fontSize: design.type.body,
    lineHeight: 21,
    maxWidth: 360,
    textAlign: "center",
  },
  card: {
    gap: design.spacing.md,
  },
  field: {
    gap: design.spacing.xs,
  },
  label: {
    fontSize: design.type.meta,
    fontWeight: "700",
  },
  input: {
    borderRadius: design.radius.md,
    borderWidth: 1,
    fontSize: design.type.body,
    minHeight: 48,
    paddingHorizontal: design.spacing.md,
    paddingVertical: design.spacing.sm,
  },
  error: {
    borderRadius: design.radius.md,
    padding: design.spacing.sm,
  },
  errorText: {
    fontSize: design.type.meta,
    lineHeight: 18,
  },
  primaryButton: {
    alignItems: "center",
    borderRadius: design.radius.pill,
    justifyContent: "center",
    minHeight: 50,
    paddingHorizontal: design.spacing.lg,
  },
  primaryButtonText: {
    fontSize: design.type.body,
    fontWeight: "700",
  },
  dividerRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: design.spacing.sm,
  },
  divider: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: design.type.meta,
  },
  footer: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
  },
  footerText: {
    fontSize: design.type.body,
  },
  textButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: design.touchTarget,
    paddingHorizontal: design.spacing.xs,
  },
  textButtonText: {
    fontSize: design.type.body,
    fontWeight: "700",
  },
});
