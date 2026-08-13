import { AppCard, AppScreen } from "@/components/ui/design-system";
import { design } from "@/constants/design";
import { useAppTheme } from "@/context/AppThemeContext";
import { useModal } from "@/context/ModalContext";
import { useSignUp } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

export default function SignUpScreen() {
  const { isLoaded, signUp, setActive } = useSignUp();
  const { colors } = useAppTheme();
  const { showModal } = useModal();
  const router = useRouter();

  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [pendingVerification, setPendingVerification] = useState(false);
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const onSignUpPress = async () => {
    if (!isLoaded) return;
    setIsLoading(true);

    try {
      await signUp.create({ emailAddress, password });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setPendingVerification(true);
    } catch (err) {
      console.error(JSON.stringify(err, null, 2));
      showModal({
        type: "alert",
        title: "Whoops",
        description: "Whoops an error occurred, please try again!",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const onVerifyPress = async () => {
    if (!isLoaded) return;
    setIsLoading(true);

    try {
      const signUpAttempt = await signUp.attemptEmailAddressVerification({
        code,
      });

      if (signUpAttempt.status === "complete") {
        await setActive({ session: signUpAttempt.createdSessionId });
        router.replace("/");
      } else {
        console.error(JSON.stringify(signUpAttempt, null, 2));
      }
    } catch (err) {
      console.error(JSON.stringify(err, null, 2));
      showModal({
        type: "alert",
        title: "Whoops",
        description: "Whoops an error occurred, please try again!",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const disabled = !isLoaded || isLoading;

  if (pendingVerification) {
    return (
      <AppScreen contentContainerStyle={styles.screen}>
        <View style={styles.header}>
          <Text style={[styles.eyebrow, { color: colors.accent }]}>NEUROSYNC</Text>
          <Text style={[styles.title, { color: colors.text }]}>
            Check your email
          </Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Enter the verification code sent to {emailAddress}.
          </Text>
        </View>

        <AppCard style={styles.card}>
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.text }]}>
              Verification code
            </Text>
            <TextInput
              accessibilityLabel="Verification code"
              autoComplete="one-time-code"
              keyboardType="numeric"
              onChangeText={setCode}
              onSubmitEditing={() => void onVerifyPress()}
              placeholder="Enter your code"
              placeholderTextColor={colors.textFaint}
              returnKeyType="done"
              style={[
                styles.input,
                {
                  backgroundColor: colors.surfaceMuted,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              value={code}
            />
          </View>

          <PrimaryButton
            disabled={disabled}
            label={isLoading ? "Verifying…" : "Verify email"}
            onPress={() => void onVerifyPress()}
          />
        </AppCard>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.textMuted }]}>
            Need to use a different email?
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setPendingVerification(false)}
            style={styles.textButton}
          >
            <Text style={[styles.textButtonText, { color: colors.accent }]}>
              Go back
            </Text>
          </Pressable>
        </View>
      </AppScreen>
    );
  }

  return (
    <AppScreen contentContainerStyle={styles.screen}>
      <View style={styles.header}>
        <Text style={[styles.eyebrow, { color: colors.accent }]}>NEUROSYNC</Text>
        <Text style={[styles.title, { color: colors.text }]}>
          Create your account
        </Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          Set up a private space for your tasks, timing, and support preferences.
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
            autoComplete="new-password"
            onChangeText={setPassword}
            onSubmitEditing={() => void onSignUpPress()}
            placeholder="Create a password"
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

        <PrimaryButton
          disabled={disabled}
          label={isLoading ? "Creating account…" : "Create account"}
          onPress={() => void onSignUpPress()}
        />
      </AppCard>

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: colors.textMuted }]}>
          Already have an account?
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.canGoBack() && router.back()}
          style={styles.textButton}
        >
          <Text style={[styles.textButtonText, { color: colors.accent }]}>
            Sign in
          </Text>
        </Pressable>
      </View>
    </AppScreen>
  );
}

function PrimaryButton({
  disabled,
  label,
  onPress,
}: {
  disabled: boolean;
  label: string;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        {
          backgroundColor: pressed ? colors.accentPressed : colors.accent,
          opacity: disabled ? 0.55 : 1,
        },
      ]}
    >
      <Text style={[styles.primaryButtonText, { color: colors.accentText }]}>
        {label}
      </Text>
    </Pressable>
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
    maxWidth: 390,
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
