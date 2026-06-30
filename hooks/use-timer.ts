import { useCallback, useEffect, useRef, useState } from "react";

export const useTimer = (taskId: string) => {
  const [startedAt, setstartedAt] = useState<number | null>(null);
  const [accumulatedSeconds, setaccumulatedSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const intervalIdRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionStartRef = useRef<number>(0);
  const firstStartedAtRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isRunning || startedAt == null) return;

    intervalIdRef.current = setInterval(() => {
      const now = Date.now();

      setElapsedSeconds(accumulatedSeconds + (now - startedAt) / 1000);
    }, 1000);

    return () => {
      if (intervalIdRef.current != null) {
        clearInterval(intervalIdRef.current);
        intervalIdRef.current = null;
      }
    };
  }, [startedAt, accumulatedSeconds, isRunning]);

  const start = useCallback(() => {
    if (isRunning) return;

    setIsRunning(true);
    setstartedAt(Date.now());
    sessionStartRef.current = accumulatedSeconds;
    firstStartedAtRef.current = firstStartedAtRef.current ?? new Date().toISOString();
  }, [isRunning, accumulatedSeconds]);

  const pause = useCallback(async (): Promise<number | null> => {
    const now = Date.now();

    if (isRunning && startedAt != null) {
      const newAccumulated = accumulatedSeconds + (now - startedAt) / 1000;

      setaccumulatedSeconds(newAccumulated);
      setElapsedSeconds(newAccumulated);

      setIsRunning(false);
      setstartedAt(null);

      return newAccumulated;
    }

    return null;
  }, [isRunning, startedAt, accumulatedSeconds, taskId]);

  const reset = useCallback(() => {
    setIsRunning(false);
    setaccumulatedSeconds(0);
    setElapsedSeconds(0);
    setstartedAt(null);
    sessionStartRef.current = 0;
    firstStartedAtRef.current = null;
  }, []);

  return {
    start,
    isRunning,
    elapsedSeconds,
    accumulatedSeconds,
    startedAt: firstStartedAtRef.current,
    pause,
    reset,
  };
};
