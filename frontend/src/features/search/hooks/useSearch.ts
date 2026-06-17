"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS } from "@/types";
import type { SearchParams, SearchResponse, SearchResultKind } from "../types";

// ─── Query keys ───────────────────────────────────────────────────────────────

export const searchKeys = {
  all: ["search"] as const,
  query: (params: SearchParams) => [...searchKeys.all, params] as const,
};

// ─── Build query-string params for GET /api/search ───────────────────────────

function buildSearchParams(
  params: SearchParams,
): Record<string, string | number | boolean | undefined | null> {
  const out: Record<string, string | number | boolean | undefined | null> = {
    q: params.q,
  };
  // limit is per-kind; default is 20, max 50
  if (params.limit !== undefined) {
    out.limit = Math.min(params.limit, 50);
  }
  if (params.kinds && params.kinds.length > 0) {
    // Backend accepts comma-separated: kinds=task,project,habit
    out.kinds = params.kinds.join(",");
  }
  return out;
}

// ─── Primary search hook ──────────────────────────────────────────────────────

/**
 * Debounced, deduped search query. Only fires when `q` is non-empty and
 * `enabled` is true (defaults to true).
 */
export function useSearchQuery(
  params: SearchParams,
  options: { enabled?: boolean } = {},
) {
  const { enabled = true } = options;

  const trimmedQuery = params.q.trim();
  const isActive = enabled && trimmedQuery.length > 0;

  return useQuery({
    queryKey: searchKeys.query({ ...params, q: trimmedQuery }),
    queryFn: () =>
      api.get<SearchResponse>(
        API_ENDPOINTS.SEARCH,
        buildSearchParams({ ...params, q: trimmedQuery }),
      ),
    enabled: isActive,
    // Search results go stale fast; keep for 30 s in cache so navigating
    // back feels instant, but always refetch in the background.
    staleTime: 30_000,
    gcTime: 60_000,
    // No retry on search — stale result is better than spinner on flaky net
    retry: false,
    placeholderData: (prev) => prev,
  });
}

// ─── Convenience: search filtered by a single kind ───────────────────────────

export function useSearchByKind(
  q: string,
  kind: SearchResultKind,
  limit = 10,
) {
  return useSearchQuery({ q, kinds: [kind], limit });
}
