import React, { createContext, useContext, useMemo, useState } from "react";

type ActiveTimer = {
  taskId: string;
  startedAt: number;
  accumulatedSeconds: number;
} | null;

type ActiveTimerContextValue = {
  activeTimer: ActiveTimer;
  setActiveTimer: (timer: ActiveTimer) => void;
};

const ActiveTimerContext = createContext<ActiveTimerContextValue | null>(null);

/**
 * Publishes which task (if any) currently has a running focus timer.
 * The focus timer screen writes to this; TaskRow reads it to render a
 * live "Focusing · mm:ss" state in the list without needing the timer
 * itself to live in the same component tree.
 */
export function ActiveTimerProvider({ children }: { children: React.ReactNode }) {
  const [activeTimer, setActiveTimer] = useState<ActiveTimer>(null);

  const value = useMemo(() => ({ activeTimer, setActiveTimer }), [activeTimer]);

  return (
    <ActiveTimerContext.Provider value={value}>
      {children}
    </ActiveTimerContext.Provider>
  );
}

export function useActiveTimer() {
  const context = useContext(ActiveTimerContext);

  if (!context) {
    throw new Error("useActiveTimer must be used within ActiveTimerProvider");
  }

  return context;
}
