import { defineQuery } from "groq";
import {
  DEFAULT_USER_TIME_SETTINGS,
  type ThemeMode,
  type TimeEstimationMode,
  type UserTimeSettings,
} from "@/lib/utils/time-wisdom";
import { sanityClient } from "./client";

type LegacyTimeEstimateMode =
  | "bucket"
  | "presetMinutes"
  | "customMinutes"
  | "skip";

type LegacyUserSettingsFields = {
  timeEstimateMode?: LegacyTimeEstimateMode | null;
};

export type UserSettingsInput = Partial<UserTimeSettings> & {
  userId: string;
  createdAt?: string;
  updatedAt?: string;
};

export type UserSettingsDocument = UserTimeSettings & {
  _id: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
};

export const USER_SETTINGS_QUERY = defineQuery(`*[
  _type == "userSettings"
  && userId == $userId
][0] {
  _id,
  userId,
  preferredTimeEstimationMode,
  timeEstimateMode,
  themeMode,
  createdAt,
  updatedAt
}`);

export const mapLegacyTimeEstimationMode = (
  legacyMode?: LegacyTimeEstimateMode | null,
): TimeEstimationMode => {
  if (legacyMode === "presetMinutes") return "minutes";
  if (legacyMode === "customMinutes") return "custom";

  return "relative";
};

const normalizeSettings = (
  settings: Partial<UserSettingsDocument> &
    LegacyUserSettingsFields & { _id: string; userId: string },
): UserSettingsDocument => {
  const now = new Date().toISOString();

  return {
    _id: settings._id,
    userId: settings.userId,
    preferredTimeEstimationMode:
      settings.preferredTimeEstimationMode ??
      mapLegacyTimeEstimationMode(settings.timeEstimateMode),
    themeMode: settings.themeMode ?? DEFAULT_USER_TIME_SETTINGS.themeMode,
    createdAt: settings.createdAt ?? now,
    updatedAt: settings.updatedAt ?? now,
  };
};

export const createDefaultUserSettings = async (
  userId: string,
): Promise<UserSettingsDocument> => {
  const now = new Date().toISOString();
  const settings = {
    _type: "userSettings" as const,
    userId,
    ...DEFAULT_USER_TIME_SETTINGS,
    createdAt: now,
    updatedAt: now,
  };

  try {
    const result = await sanityClient.create(settings);
    return normalizeSettings(result);
  } catch (error) {
    console.error("Error creating user settings:", error);
    throw error;
  }
};

export const fetchUserSettings = async (
  userId: string,
): Promise<UserSettingsDocument> => {
  try {
    const settings = await sanityClient.fetch(USER_SETTINGS_QUERY, { userId });

    if (settings?._id) {
      return normalizeSettings(settings);
    }

    return await createDefaultUserSettings(userId);
  } catch (error) {
    console.error("Error fetching user settings:", error);
    throw error;
  }
};

export const updateUserSettings = async (
  settingsId: string,
  input: Partial<{
    preferredTimeEstimationMode: TimeEstimationMode;
    themeMode: ThemeMode;
  }>,
): Promise<UserSettingsDocument> => {
  try {
    const result = (await sanityClient
      .patch(settingsId)
      .set({
        ...input,
        updatedAt: new Date().toISOString(),
      })
      .commit()) as Partial<UserSettingsDocument> &
      LegacyUserSettingsFields & {
        _id: string;
        userId: string;
      };

    return normalizeSettings(result);
  } catch (error) {
    console.error("Error updating user settings:", error);
    throw error;
  }
};
