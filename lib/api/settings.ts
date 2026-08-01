import type {
  ThemeMode,
  TimeEstimationMode,
  UserTimeSettings,
} from "@/lib/utils/time-wisdom";
import {
  authenticatedAPIRequest,
  type GetClerkToken,
} from "./client";

export type UserSettings = UserTimeSettings & {
  createdAt: string;
  updatedAt: string;
};

export type UserSettingsUpdate = Partial<{
  preferredTimeEstimationMode: TimeEstimationMode;
  themeMode: ThemeMode;
}>;

export const fetchUserSettings = async (
  getToken: GetClerkToken,
): Promise<UserSettings> => {
  return authenticatedAPIRequest<UserSettings>(
    "/v1/settings",
    getToken,
  );
};

export const updateUserSettings = async (
  getToken: GetClerkToken,
  input: UserSettingsUpdate,
): Promise<UserSettings> => {
  return authenticatedAPIRequest<UserSettings>(
    "/v1/settings",
    getToken,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    },
  );
};
