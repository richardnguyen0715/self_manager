"use client";

import { useState, useEffect, useRef } from "react";
import { useDocsSearch } from "@/features/docs/hooks/useDocs";
import type { DocSearchResult } from "@/types";

/** Default debounce in ms — matches the contract spec (~250 ms). */
const DEBOUNCE_MS = 250;

/**
 * Thin debounce wrapper around `useDocsSearch`.
 *
 * Accepts a raw (non-debounced) query string, debounces it, then delegates to
 * `useDocsSearch` from useDocs. Returns the same shape as the underlying hook
 * plus `isDebouncing` so callers can show a spinner during the delay.
 *
 * @param raw       - The live (non-debounced) query, e.g. bound directly to an input.
 * @param spaceId   - Optional space scope forwarded to the API.
 * @param delay     - Override debounce delay (ms). Defaults to DEBOUNCE_MS.
 */
export function useDocsSearchDebounced(
  raw: string,
  spaceId?: string,
  delay = DEBOUNCE_MS,
) {
  const [debouncedQ, setDebouncedQ] = useState(raw.trim());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track whether we are still in the debounce window
  const [isDebouncing, setIsDebouncing] = useState(false);

  useEffect(() => {
    const trimmed = raw.trim();

    // If empty, reset immediately — no delay needed
    if (!trimmed) {
      if (timerRef.current) clearTimeout(timerRef.current);
      setDebouncedQ("");
      setIsDebouncing(false);
      return;
    }

    setIsDebouncing(true);

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      setDebouncedQ(trimmed);
      setIsDebouncing(false);
    }, delay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [raw, delay]);

  const query = useDocsSearch(debouncedQ, spaceId);

  // Combine TanStack Query fetching state with local debounce state
  const isFetching = isDebouncing || query.isFetching;

  const data: DocSearchResult = {
    pages: query.data?.pages ?? [],
    databases: query.data?.databases ?? [],
  };

  return {
    ...query,
    data,
    isFetching,
    isDebouncing,
    debouncedQ,
  };
}
