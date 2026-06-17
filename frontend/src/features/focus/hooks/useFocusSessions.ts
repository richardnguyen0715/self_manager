import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { ApiClientError } from "@/lib/query";
import type { FocusSession } from "@/types";
import { API_ENDPOINTS } from "@/types";
import type {
  StartSessionRequest,
  FinishSessionRequest,
  FocusSessionsParams,
} from "../types";

// ─── Query keys ───────────────────────────────────────────────────────────────

export const focusKeys = {
  all: ["focus"] as const,
  sessions: () => [...focusKeys.all, "sessions"] as const,
  sessionsList: (blockId: string) =>
    [...focusKeys.sessions(), blockId] as const,
  stats: () => [...focusKeys.all, "stats"] as const,
};

// ─── Sessions list ────────────────────────────────────────────────────────────
// GET /api/timeblocks/:id/focus-sessions → { data: FocusSession[] }

export function useFocusSessionsList(params: FocusSessionsParams) {
  return useQuery({
    queryKey: focusKeys.sessionsList(params.blockId),
    enabled: !!params.blockId,
    queryFn: () =>
      api
        .get<{ data: FocusSession[] }>(API_ENDPOINTS.FOCUS_SESSIONS(params.blockId))
        .then((res) => res.data),
    staleTime: 1000 * 60, // 1 min
    retry: (count, error) => {
      if (error instanceof ApiClientError && error.status === 404) return false;
      return count < 2;
    },
  });
}

// ─── Start session ────────────────────────────────────────────────────────────
// POST /api/timeblocks/:id/focus-sessions  body: { mode? }
// → 201 + { data: FocusSession }

export function useStartSession() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({
      blockId,
      data,
    }: {
      blockId: string;
      data: StartSessionRequest;
    }) =>
      api
        .post<{ data: FocusSession }>(API_ENDPOINTS.FOCUS_SESSIONS(blockId), data)
        .then((res) => res.data),
    onSuccess: (_session, { blockId }) => {
      qc.invalidateQueries({ queryKey: focusKeys.sessionsList(blockId) });
      qc.invalidateQueries({ queryKey: focusKeys.stats() });
    },
  });
}

// ─── Pause session ────────────────────────────────────────────────────────────
// PATCH /api/timeblocks/:blockId/focus-sessions/:sessionId/pause
// → { data: FocusSession }

export function usePauseSession() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({
      blockId,
      sessionId,
    }: {
      blockId: string;
      sessionId: string;
    }) =>
      api
        .patch<{ data: FocusSession }>(
          API_ENDPOINTS.FOCUS_SESSION_PAUSE(blockId, sessionId),
        )
        .then((res) => res.data),
    onSuccess: (_session, { blockId }) => {
      qc.invalidateQueries({ queryKey: focusKeys.sessionsList(blockId) });
    },
  });
}

// ─── Resume session ───────────────────────────────────────────────────────────
// PATCH /api/timeblocks/:blockId/focus-sessions/:sessionId/resume
// → { data: FocusSession }

export function useResumeSession() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({
      blockId,
      sessionId,
    }: {
      blockId: string;
      sessionId: string;
    }) =>
      api
        .patch<{ data: FocusSession }>(
          API_ENDPOINTS.FOCUS_SESSION_RESUME(blockId, sessionId),
        )
        .then((res) => res.data),
    onSuccess: (_session, { blockId }) => {
      qc.invalidateQueries({ queryKey: focusKeys.sessionsList(blockId) });
    },
  });
}

// ─── Finish session ───────────────────────────────────────────────────────────
// PATCH /api/timeblocks/:blockId/focus-sessions/:sessionId/finish
// body: { duration_seconds: number }
// → { data: FocusSession }

export function useFinishSession() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({
      blockId,
      sessionId,
      data,
    }: {
      blockId: string;
      sessionId: string;
      data: FinishSessionRequest;
    }) =>
      api
        .patch<{ data: FocusSession }>(
          API_ENDPOINTS.FOCUS_SESSION_FINISH(blockId, sessionId),
          data,
        )
        .then((res) => res.data),
    onSuccess: (_session, { blockId }) => {
      qc.invalidateQueries({ queryKey: focusKeys.all });
      qc.invalidateQueries({ queryKey: focusKeys.sessionsList(blockId) });
    },
  });
}
