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
import { useUser } from "@clerk/clerk-expo";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

const Settings = () => {
  const { user } = useUser();
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
  const theme = settingsThemes[activeSettings.themeMode];

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
      loadSettings();
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
      setStatus("Saved");
    } catch (error) {
      console.error("Error saving settings:", error);
      setStatus("Could not save settings.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.contentContainer}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.panel}>
        <Text style={[styles.title, { color: theme.text }]}>Settings</Text>

        <View
          style={[
            styles.section,
            { backgroundColor: theme.surface, borderColor: theme.line },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Preferred Time Estimation Method
          </Text>
          <View style={styles.optionStack}>
            {timeEstimationModes.map((mode) => (
              <Pressable
                key={mode}
                style={styles.radioRow}
                onPress={() =>
                  saveSettings({ preferredTimeEstimationMode: mode })
                }
                disabled={isSaving}
              >
                <View
                  style={[
                    styles.radio,
                    { borderColor: theme.text },
                    activeSettings.preferredTimeEstimationMode === mode && {
                      backgroundColor: theme.text,
                    },
                  ]}
                />
                <Text style={[styles.optionText, { color: theme.text }]}>
                  {getTimeEstimationModeLabel(mode)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View
          style={[
            styles.section,
            { backgroundColor: theme.surface, borderColor: theme.line },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Appearance
          </Text>
          <View style={styles.optionGrid}>
            {(["dark", "light"] as ThemeMode[]).map((mode) => (
              <Pressable
                key={mode}
                style={[
                  styles.themeOption,
                  { borderColor: theme.line },
                  activeSettings.themeMode === mode && styles.selectedOption,
                ]}
                onPress={() => saveSettings({ themeMode: mode })}
                disabled={isSaving}
              >
                <Text style={[styles.themeOptionText, { color: theme.text }]}>
                  {mode === "dark" ? "Dark" : "Light"}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {status ? (
          <Text style={[styles.statusText, { color: theme.subtle }]}>
            {status}
          </Text>
        ) : null}
      </View>
    </ScrollView>
  );
};

export default Settings;

const timeEstimationModes: TimeEstimationMode[] = [
  "relative",
  "minutes",
  "custom",
];

const settingsThemes = {
  dark: {
    background: "#050505",
    surface: "#151515",
    line: "#f2efe6",
    text: "#f8f5ee",
    subtle: "#bdb6aa",
  },
  light: {
    background: "#fbf7ef",
    surface: "#fffdf8",
    line: "#2b2925",
    text: "#25231f",
    subtle: "#6f685f",
  },
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  contentContainer: {
    alignItems: "center",
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingVertical: 32,
  },
  panel: {
    gap: 18,
    maxWidth: 720,
    width: "100%",
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    textAlign: "center",
  },
  section: {
    borderRadius: 8,
    borderWidth: 1,
    gap: 16,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "900",
  },
  optionStack: {
    gap: 16,
  },
  radioRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    minHeight: 32,
  },
  radio: {
    borderRadius: 999,
    borderWidth: 2,
    height: 22,
    width: 22,
  },
  optionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: "800",
  },
  optionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  themeOption: {
    alignItems: "center",
    borderRadius: 4,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: 14,
  },
  selectedOption: {
    backgroundColor: "#9ccf9b",
    borderColor: "#315f30",
  },
  themeOptionText: {
    fontSize: 14,
    fontWeight: "800",
  },
  statusText: {
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
  },
});
