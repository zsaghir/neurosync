import { getAppColors, type AppColors } from "@/constants/design";
import {
  fetchUserSettings,
  type UserSettings,
} from "@/lib/api/settings";
import type { ThemeMode } from "@/lib/utils/time-wisdom";
import { useAuth } from "@clerk/clerk-expo";
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
  settings: UserSettings | null;
  refreshSettings: () => Promise<void>;
  setMode: (mode: ThemeMode) => void;
};

const AppThemeContext = createContext<AppThemeContextValue | null>(null);

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const { getToken, isSignedIn } = useAuth();
  const [mode, setMode] = useState<ThemeMode>("light");
  const [settings, setSettings] = useState<UserSettings | null>(null);

  const refreshSettings = useCallback(async () => {
    if (!isSignedIn) {
      setSettings(null);
      setMode("light");
      return;
    }

    try {
      const nextSettings = await fetchUserSettings(getToken);
      setSettings(nextSettings);
      setMode(nextSettings.themeMode);
    } catch (error) {
      console.error("Error loading app theme:", error);
    }
  }, [getToken, isSignedIn]);

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
