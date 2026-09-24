import { getAppColors, type AppColors } from "@/constants/design";
import { useUserSettings } from "@/hooks/queries/settings";
import type { UserSettings } from "@/lib/api/settings";
import type { ThemeMode } from "@/lib/utils/time-wisdom";
import React, { createContext, useContext, useMemo } from "react";

type AppThemeContextValue = {
  colors: AppColors;
  mode: ThemeMode;
  settings: UserSettings | null;
  /** False only while a signed-in user's saved theme is still being fetched. */
  isThemeResolved: boolean;
};

const AppThemeContext = createContext<AppThemeContextValue | null>(null);

/**
 * Derives the theme from the shared settings cache. Saving settings updates
 * that cache, so the theme changes everywhere without a separate refresh.
 */
export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const settingsQuery = useUserSettings();
  const settings = settingsQuery.data ?? null;
  const mode: ThemeMode = settings?.themeMode ?? "light";
  // A disabled query (signed out) is also "pending", so check fetchStatus too.
  const isThemeResolved = !(settingsQuery.isPending && settingsQuery.fetchStatus === "fetching");

  const value = useMemo(
    () => ({
      colors: getAppColors(mode),
      mode,
      settings,
      isThemeResolved,
    }),
    [isThemeResolved, mode, settings],
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
