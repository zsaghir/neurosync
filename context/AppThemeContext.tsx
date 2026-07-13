import { getAppColors, type AppColors } from "@/constants/design";
import {
  fetchUserSettings,
  type UserSettingsDocument,
} from "@/lib/sanity/userSettings";
import type { ThemeMode } from "@/lib/utils/time-wisdom";
import { useUser } from "@clerk/clerk-expo";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type AppThemeContextValue = {
  colors: AppColors;
  mode: ThemeMode;
  settings: UserSettingsDocument | null;
  refreshSettings: () => Promise<void>;
  setMode: (mode: ThemeMode) => void;
};

const AppThemeContext = createContext<AppThemeContextValue | null>(null);

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const [mode, setMode] = useState<ThemeMode>("light");
  const [settings, setSettings] = useState<UserSettingsDocument | null>(null);

  const refreshSettings = useCallback(async () => {
    if (!user) {
      setSettings(null);
      setMode("light");
      return;
    }

    try {
      const nextSettings = await fetchUserSettings(user.id);
      setSettings(nextSettings);
      setMode(nextSettings.themeMode);
    } catch (error) {
      console.error("Error loading app theme:", error);
    }
  }, [user]);

  useEffect(() => {
    void refreshSettings();
  }, [refreshSettings]);

  const value = useMemo(
    () => ({
      colors: getAppColors(mode),
      mode,
      settings,
      refreshSettings,
      setMode,
    }),
    [mode, refreshSettings, settings],
  );

  return (
    <AppThemeContext.Provider value={value}>
      {children}
    </AppThemeContext.Provider>
  );
}

export function useAppTheme() {
  const context = useContext(AppThemeContext);

  if (!context) {
    throw new Error("useAppTheme must be used within AppThemeProvider");
  }

  return context;
}
