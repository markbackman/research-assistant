import { useState, useEffect } from "react";

/**
 * Returns a live-updating elapsed time in seconds since `startedAt`.
 * If `completedAt` is set, returns the final duration instead.
 */
export function useElapsedTime(
  startedAt?: string,
  completedAt?: string
): number | null {
  const [elapsed, setElapsed] = useState<number | null>(null);

  useEffect(() => {
    if (!startedAt) {
      setElapsed(null);
      return;
    }

    const startMs = new Date(startedAt).getTime();

    if (completedAt) {
      const endMs = new Date(completedAt).getTime();
      setElapsed(Math.round((endMs - startMs) / 100) / 10);
      return;
    }

    // Live-updating tick
    const update = () => {
      setElapsed(Math.round((Date.now() - startMs) / 100) / 10);
    };
    update();
    const id = setInterval(update, 100);
    return () => clearInterval(id);
  }, [startedAt, completedAt]);

  return elapsed;
}
