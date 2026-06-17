import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { FocusSession, FocusMode } from "@/types";
import { API_ENDPOINTS } from "@/types";
import { useTimeBlockingStore } from "../timeblocking.store";

// ─── Query keys ───────────────────────────────────────────────────────────────

export const focusKeys = {
  all: ["focus-sessions"] as const,
  lists: () => [...focusKeys.all, "list"] as const,
  forBlock: (blockId: string) =>
    [...focusKeys.all, "block", blockId] as const,
  detail: (id: string) => [...focusKeys.all, "detail", id] as const,
};

// ─── API shapes ───────────────────────────────────────────────────────────────

// Re-export FocusMode from @/types so callers can import it from here
export type { FocusMode };

export interface StartFocusSessionPayload {
  blockId: string;
  mode?: FocusMode;
}

// ─── Response envelope ────────────────────────────────────────────────────────

interface FocusSessionEnvelope {
  data: FocusSession;
}

interface FocusSessionListEnvelope {
  data: FocusSession[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Derive a synthetic status from FocusSession fields since the backend model
 * does not include a `status` field — it is inferred from ended_at / paused_at.
 */
export function getFocusSessionStatus(
  session: FocusSession,
): "active" | "paused" | "finished" {
  if (session.ended_at != null) return "finished";
  if (session.paused_at != null) return "paused";
  return "active";
}

/**
 * Return the work-duration in minutes for a given focus mode.
 * Used by the timer display.
 */
export function getFocusWorkMinutes(mode: FocusMode): number {
  if (mode === "pomodoro_25_5") return 25;
  if (mode === "deep_work_50_10") return 50;
  return 25; // custom — treat as 25 min by default
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

/** List all focus sessions for a given time block. */
export function useFocusSessions(blockId: string) {
  return useQuery<FocusSessionListEnvelope>({
    queryKey: focusKeys.forBlock(blockId),
    queryFn: () =>
      api.get<FocusSessionListEnvelope>(
        API_ENDPOINTS.FOCUS_SESSIONS(blockId),
      ),
    enabled: Boolean(blockId),
    staleTime: 1000 * 30,
  });
}

/** Start a new focus session on a specific time block. */
export function useStartFocusSession() {
  const qc = useQueryClient();
  const { openFocusPanel } = useTimeBlockingStore();

  return useMutation<FocusSessionEnvelope, Error, StartFocusSessionPayload>({
    mutationFn: ({ blockId, mode }) =>
      api.post<FocusSessionEnvelope>(
        API_ENDPOINTS.FOCUS_SESSIONS(blockId),
        mode ? { mode } : {},
      ),
    onSuccess: ({ data }, { blockId }) => {
      qc.invalidateQueries({ queryKey: focusKeys.forBlock(blockId) });
      openFocusPanel(data);
    },
  });
}

/** Pause an active focus session. */
export function usePauseFocusSession() {
  const qc = useQueryClient();
  const { setActiveFocusSession } = useTimeBlockingStore();

  return useMutation<
    FocusSessionEnvelope,
    Error,
    { blockId: string; sessionId: string }
  >({
    mutationFn: ({ blockId, sessionId }) =>
      api.patch<FocusSessionEnvelope>(
        API_ENDPOINTS.FOCUS_SESSION_PAUSE(blockId, sessionId),
        {},
      ),
    onSuccess: ({ data }, { blockId }) => {
      setActiveFocusSession(data);
      qc.invalidateQueries({ queryKey: focusKeys.forBlock(blockId) });
      qc.invalidateQueries({ queryKey: focusKeys.detail(data.id) });
    },
  });
}

/** Resume a paused focus session. */
export function useResumeFocusSession() {
  const qc = useQueryClient();
  const { setActiveFocusSession, resetFocusTimer } = useTimeBlockingStore();

  return useMutation<
    FocusSessionEnvelope,
    Error,
    { blockId: string; sessionId: string }
  >({
    mutationFn: ({ blockId, sessionId }) =>
      api.patch<FocusSessionEnvelope>(
        API_ENDPOINTS.FOCUS_SESSION_RESUME(blockId, sessionId),
        {},
      ),
    onSuccess: ({ data }, { blockId }) => {
      setActiveFocusSession(data);
      resetFocusTimer();
      qc.invalidateQueries({ queryKey: focusKeys.forBlock(blockId) });
    },
  });
}

/** Finish (complete) a focus session. */
export function useFinishFocusSession() {
  const qc = useQueryClient();
  const { closeFocusPanel } = useTimeBlockingStore();

  return useMutation<
    FocusSessionEnvelope,
    Error,
    { blockId: string; sessionId: string; duration_seconds: number }
  >({
    mutationFn: ({ blockId, sessionId, duration_seconds }) =>
      api.patch<FocusSessionEnvelope>(
        API_ENDPOINTS.FOCUS_SESSION_FINISH(blockId, sessionId),
        { duration_seconds },
      ),
    onSuccess: ({ data }, { blockId }) => {
      closeFocusPanel();
      qc.invalidateQueries({ queryKey: focusKeys.forBlock(blockId) });
      qc.invalidateQueries({
        queryKey: ["time-blocks", "detail", blockId],
      });
      qc.invalidateQueries({ queryKey: ["time-blocks", "list"] });
    },
  });
}
