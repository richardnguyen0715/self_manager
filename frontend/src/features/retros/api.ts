import { api } from "@/lib/api";
import type { OpenRetroPayload, RetroDetail } from "./types";

// ─── Retro API endpoints (contract: design/retro-system.md section 4) ─────────
// Kept inside the feature so the shared API_ENDPOINTS map is not touched.

const BASE = "/api/retros";

export const RETRO_ENDPOINTS = {
  // Templates
  TEMPLATES: `${BASE}/templates`,
  TEMPLATE_BY_ID: (id: string) => `${BASE}/templates/${id}`,

  // Retros
  OPEN: `${BASE}/open`,
  LIST: BASE,
  TRENDS: `${BASE}/trends`,
  BY_TARGET: `${BASE}/by-target`,
  ACTIONS: `${BASE}/actions`,
  BY_ID: (id: string) => `${BASE}/${id}`,
  REFRESH_SNAPSHOT: (id: string) => `${BASE}/${id}/refresh-snapshot`,
  COMPLETE: (id: string) => `${BASE}/${id}/complete`,
  REOPEN: (id: string) => `${BASE}/${id}/reopen`,

  // Entries
  ENTRIES: (retroId: string) => `${BASE}/${retroId}/entries`,
  ENTRY_BY_ID: (entryId: string) => `${BASE}/entries/${entryId}`,

  // Links
  LINKS: (retroId: string) => `${BASE}/${retroId}/links`,
  LINK_BY_ID: (linkId: string) => `${BASE}/links/${linkId}`,

  // Actions
  RETRO_ACTIONS: (retroId: string) => `${BASE}/${retroId}/actions`,
  ACTION_BY_ID: (actionId: string) => `${BASE}/actions/${actionId}`,
  ACTION_CONVERT: (actionId: string) => `${BASE}/actions/${actionId}/convert`,
} as const;

/** POST /api/retros/open without touching the React Query cache. */
export function openRetroRequest(payload: OpenRetroPayload) {
  return api.post<RetroDetail>(RETRO_ENDPOINTS.OPEN, payload);
}
