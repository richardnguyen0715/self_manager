"use client";

import { useEffect, useRef } from "react";
import { useFocusStore } from "../store";

/**
 * Drives the client-side countdown.
 * Fires every second when clientStartedAt is set.
 * Automatically cleans up when the component unmounts.
 */
export function useTimerTick() {
  const tick = useFocusStore((s) => s.tick);
  const clientStartedAt = useFocusStore((s) => s.clientStartedAt);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (clientStartedAt !== null) {
      // Clear any existing interval before starting a new one
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(tick, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [clientStartedAt, tick]);
}
