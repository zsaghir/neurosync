import { Checkbox } from "@/components/ui/Checkbox";
import { AppCard, SectionLabel } from "@/components/ui/design-system";
import { SignOutButton } from "@/components/SignOutButton";
import { design } from "@/constants/design";
import { useAppTheme } from "@/context/AppThemeContext";
import {
  fetchUserSettings,
  updateUserSettings,
  type UserSettingsDocument,
} from "@/lib/sanity/userSettings";
import {
  DEFAULT_USER_TIME_SETTINGS,
  getTimeEstimationModeLabel,
  type ThemeMode,
  type TimeEstimationMode,
} from "@/lib/utils/time-wisdom";
import { useClerk, useUser } from "@clerk/clerk-expo";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const timeEstimationModes: TimeEstimationMode[] = ["relative", "minutes", "custom"];

export default function Settings() {
  const { user } = useUser();
  const clerk = useClerk();
  const { colors, refreshSettings } = useAppTheme();
  const [settings, setSettings] = useState<UserSettingsDocument | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState("");

  const activeSettings = settings ?? {
    _id: "default",
    userId: user?.id ?? "",
    ...DEFAULT_USER_TIME_SETTINGS,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const loadSettings = useCallback(async () => {
    if (!user) return;

    try {
      const nextSettings = await fetchUserSettings(user.id);
      setSettings(nextSettings);
    } catch (error) {
      console.error("Error loading settings:", error);
      setStatus("Could not load settings.");
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void loadSettings();
    }, [loadSettings]),
  );

  const saveSettings = async (
    input: Partial<{
      preferredTimeEstimationMode: TimeEstimationMode;
      themeMode: ThemeMode;
    }>,
  ) => {
    if (!settings || isSaving) return;

    setIsSaving(true);
    setStatus("");
    try {
      const updatedSettings = await updateUserSettings(settings._id, input);
      setSettings(updatedSettings);
      // Keep the app-wide theme (tab bar, screens) in sync immediately.
      await refreshSettings();
      setStatus("Saved");
    } catch (error) {
      console.error("Error saving settings:", error);
      setStatus("Could not save settings.");
    } finally {
      setIsSaving(false);
    }
  };

  const googleAccount = user?.externalAccounts?.find(
    (account) => account.provider === "google",
  );
  const connectedEmail =
    googleAccount?.emailAddress ?? user?.primaryEmailAddress?.emailAddress ?? "";

  const handleManage = () => {
    const openUserProfile = (clerk as { openUserProfile?: () => void })
      .openUserProfile;

    if (typeof openUserProfile === "function") {
      openUserProfile();
      return;
    }

    Alert.alert(
      "Manage sign-in",
      googleAccount
        ? "Manage or disconnect Google sign-in from your Google account settings."
        : "Manage your email sign-in from your account provider.",
    );
  };

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.title, { color: colors.text }]}>Settings</Text>

        <AppCard style={styles.profileRow}>
          <View style={styles.profileText}>
            <Text style={[styles.profileName, { color: colors.text }]}>
              {user?.fullName || user?.firstName || "Your account"}
            </Text>
            <Text style={[styles.profileEmail, { color: colors.textMuted }]}>
              {connectedEmail}
            </Text>
          </View>
          <SignOutButton />
        </AppCard>

        <SectionLabel style={styles.sectionLabel}>Sign-in method</SectionLabel>
        <AppCard style={styles.signInRow}>
          <View
            style={[
              styles.googleMark,
              { backgroundColor: "#FFFFFF", borderColor: colors.border },
            ]}
          >
            <Text style={styles.googleMarkText}>G</Text>
          </View>
          <View style={styles.profileText}>
            <Text style={[styles.signInTitle, { color: colors.text }]}>
              {googleAccount ? "Connected with Google" : "Signed in with email"}
            </Text>
            <Text style={[styles.signInEmail, { color: colors.textMuted }]}>
              {connectedEmail}
            </Text>
          </View>
          <Pressable onPress={handleManage} style={styles.manageTarget}>
            <Text style={[styles.manageText, { color: colors.textMuted }]}>Manage</Text>
          </Pressable>
        </AppCard>

        <SectionLabel style={styles.sectionLabel}>Preferred time estimation</SectionLabel>
        <AppCard style={styles.optionCard}>
          {timeEstimationModes.map((mode) => {
            const selected = activeSettings.preferredTimeEstimationMode === mode;
            return (
              <Pressable
                key={mode}
                style={[
                  styles.radioRow,
                  selected && { backgroundColor: colors.accentSoft },
                ]}
                onPress={() => void saveSettings({ preferredTimeEstimationMode: mode })}
                disabled={isSaving}
              >
                <Checkbox
                  checked={selected}
                  label={getTimeEstimationModeLabel(mode)}
                  size={18}
                  onPress={() => void saveSettings({ preferredTimeEstimationMode: mode })}
                />
                <Text
                  style={[
                    styles.optionText,
                    { color: colors.text },
                    selected && { fontWeight: "700" },
                  ]}
                >
                  {getTimeEstimationModeLabel(mode)}
                </Text>
              </Pressable>
            );
          })}
        </AppCard>

        <SectionLabel style={styles.sectionLabel}>Appearance</SectionLabel>
        <View style={styles.appearanceRow}>
          {(["light", "dark"] as ThemeMode[]).map((mode) => {
            const selected = activeSettings.themeMode === mode;
            return (
              <Pressable
                key={mode}
                style={[
                  styles.appearancePill,
                  selected
                    ? { backgroundColor: colors.accent }
                    : { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
                ]}
                onPress={() => void saveSettings({ themeMode: mode })}
                disabled={isSaving}
              >
                <Text
                  style={[
                    styles.appearanceText,
                    { color: selected ? colors.accentText : colors.text },
                  ]}
                >
                  {mode === "dark" ? "Dark" : "Light"}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {status ? (
          <Text style={[styles.statusText, { color: colors.textMuted }]}>{status}</Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: design.spacing.huge,
    paddingHorizontal: design.spacing.lg,
    paddingTop: design.spacing.md,
  },
  title: {
    fontSize: design.type.screenTitle,
    fontWeight: "800",
    marginBottom: design.spacing.md,
  },
  profileRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: design.spacing.lg - 2,
  },
  profileText: {
    flex: 1,
    minWidth: 0,
  },
  profileName: {
    fontSize: design.type.body + 1,
    fontWeight: "700",
  },
  profileEmail: {
    fontSize: design.type.meta,
    marginTop: 1,
  },
  sectionLabel: {
    marginBottom: design.spacing.xs,
  },
  signInRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: design.spacing.sm,
    marginBottom: design.spacing.lg - 2,
  },
  googleMark: {
    alignItems: "center",
    borderRadius: 11,
    borderWidth: 1,
    height: 22,
    justifyContent: "center",
    width: 22,
  },
  googleMarkText: {
    color: "#4285F4",
    fontSize: 12,
    fontWeight: "800",
  },
  signInTitle: {
    fontSize: design.type.body,
    fontWeight: "600",
  },
  signInEmail: {
    fontSize: design.type.caption + 0.5,
    marginTop: 1,
  },
  manageTarget: {
    justifyContent: "center",
    minHeight: design.touchTarget,
  },
  manageText: {
    fontSize: design.type.meta,
    fontWeight: "700",
  },
  optionCard: {
    gap: 2,
    marginBottom: design.spacing.lg - 2,
    padding: design.spacing.xxs,
  },
  radioRow: {
    alignItems: "center",
    borderRadius: design.radius.md,
    flexDirection: "row",
    gap: design.spacing.sm,
    minHeight: design.touchTarget,
    paddingHorizontal: design.spacing.sm + 2,
  },
  optionText: {
    fontSize: design.type.body,
  },
  appearanceRow: {
    flexDirection: "row",
    gap: design.spacing.sm,
  },
  appearancePill: {
    alignItems: "center",
    borderRadius: design.radius.pill,
    justifyContent: "center",
    minHeight: design.touchTarget,
    paddingHorizontal: design.spacing.xl - 2,
  },
  appearanceText: {
    fontSize: design.type.meta + 1,
    fontWeight: "700",
  },
  statusText: {
    fontSize: design.type.meta,
    marginTop: design.spacing.md,
    textAlign: "center",
  },
});
