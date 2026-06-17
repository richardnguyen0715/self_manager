"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS } from "@/types";
import { useAppearanceStore } from "../settings.store";
import type { AppearancePreferences, UpdateAppearancePayload } from "../types";

// ─── Query keys ────────────────────────────────────────────────────────────────

export const appearanceKeys = {
  all: ["settings", "appearance"] as const,
  prefs: () => [...appearanceKeys.all, "prefs"] as const,
} as const;

// ─── Hooks ─────────────────────────────────────────────────────────────────────

/**
 * Fetches saved appearance preferences from the server.
 * GET /api/settings/appearance
 * Also syncs into the local Zustand store so the UI reflects the server truth.
 */
export function useAppearancePrefs() {
  const applyFromServer = useAppearanceStore((s) => s.applyFromServer);

  return useQuery<AppearancePreferences, Error>({
    queryKey: appearanceKeys.prefs(),
    queryFn: async () => {
      const prefs = await api.get<AppearancePreferences>(
        API_ENDPOINTS.SETTINGS_APPEARANCE,
      );
      applyFromServer(prefs);
      return prefs;
    },
    staleTime: 1000 * 60 * 10, // Appearance rarely changes
  });
}

/**
 * Persists appearance preferences to the server.
 * PATCH /api/settings/appearance
 * Optimistically updates the local store immediately so the UI responds
 * without waiting for the network round-trip.
 */
export function useUpdateAppearancePrefs() {
  const queryClient = useQueryClient();
  const applyFromServer = useAppearanceStore((s) => s.applyFromServer);

  return useMutation<AppearancePreferences, Error, UpdateAppearancePayload>({
    mutationFn: (payload) =>
      api.patch<AppearancePreferences>(API_ENDPOINTS.SETTINGS_APPEARANCE, payload),

    onMutate: (payload) => {
      // Optimistic update: apply changes immediately from the payload
      const current = queryClient.getQueryData<AppearancePreferences>(
        appearanceKeys.prefs(),
      );
      if (current) {
        const optimistic: AppearancePreferences = { ...current, ...payload };
        applyFromServer(optimistic);
        queryClient.setQueryData<AppearancePreferences>(
          appearanceKeys.prefs(),
          optimistic,
        );
        return { previous: current };
      }
    },

    onSuccess: (updated) => {
      applyFromServer(updated);
      queryClient.setQueryData<AppearancePreferences>(
        appearanceKeys.prefs(),
        updated,
      );
    },

    onError: (_err, _vars, context) => {
      // Roll back on failure
      const ctx = context as { previous?: AppearancePreferences } | undefined;
      if (ctx?.previous) {
        applyFromServer(ctx.previous);
        queryClient.setQueryData<AppearancePreferences>(
          appearanceKeys.prefs(),
          ctx.previous,
        );
      }
    },
  });
}
