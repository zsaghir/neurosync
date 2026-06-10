import { addTimeToTask } from "@/lib/sanity/tasks";
import { useCallback, useEffect, useRef, useState } from "react";

export const useTimer = (taskId: string) => {
  const [startedAt, setstartedAt] = useState<number | null>(null);
  const [accumulatedSeconds, setaccumulatedSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const intervalIdRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionStartRef = useRef<number>(0);

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
  }, [isRunning, accumulatedSeconds]);

  const pause = useCallback(async () => {
    const now = Date.now();

    if (isRunning && startedAt != null) {
      const newAccumulated = accumulatedSeconds + (now - startedAt) / 1000;

      setaccumulatedSeconds(newAccumulated);
      setElapsedSeconds(newAccumulated);

      const sessionSeconds = newAccumulated - sessionStartRef.current;

      setIsRunning(false);
      setstartedAt(null);

      await addTimeToTask(taskId, sessionSeconds);
    }
  }, [isRunning, startedAt, accumulatedSeconds, taskId]);

  const reset = useCallback(() => {
    setIsRunning(false);
    setaccumulatedSeconds(0);
    setElapsedSeconds(0);
    setstartedAt(null);
    sessionStartRef.current = 0;
  }, []);

  return {
    start,
    isRunning,
    elapsedSeconds,
    pause,
    reset,
  };
};
