import type { FocusSession as _FocusSession, TaskListItem as _TaskListItem, FocusMode } from "@/types";

// Re-export canonical FocusMode so local code only imports from here
export type { FocusMode } from "@/types";

// ─── Focus Mode Config ─────────────────────────────────────────────────────────

export interface FocusModeConfig {
  mode: FocusMode;
  label: string;
  workMinutes: number;
  breakMinutes: number;
}

export const FOCUS_MODES: FocusModeConfig[] = [
  { mode: "pomodoro_25_5", label: "Pomodoro", workMinutes: 25, breakMinutes: 5 },
  { mode: "deep_work_50_10", label: "Deep Work", workMinutes: 50, breakMinutes: 10 },
  { mode: "custom", label: "Custom", workMinutes: 25, breakMinutes: 5 },
];

// ─── Timer Phase ───────────────────────────────────────────────────────────────

export type TimerPhase = "idle" | "work" | "break" | "finished";

// ─── Timer State (Zustand) ─────────────────────────────────────────────────────

export interface TimerState {
  phase: TimerPhase;
  /** active session from server, null when idle */
  activeSession: _FocusSession | null;
  /** the timeblock that owns the active session — required by backend routes */
  activeBlockId: string | null;
  /** selected mode before session starts */
  selectedMode: FocusMode;
  /** custom work minutes (only used when mode === "custom") */
  customWorkMinutes: number;
  /** custom break minutes (only used when mode === "custom") */
  customBreakMinutes: number;
  /** task linked to next or active session */
  linkedTaskId: string | null;
  linkedTask: _TaskListItem | null;
  /** client-side tick counter (seconds elapsed in current phase, updated by interval) */
  elapsedSeconds: number;
  /** timestamp when timer was last (re)started/resumed on the client */
  clientStartedAt: number | null;
  /** total seconds for current phase */
  totalSeconds: number;
}

// ─── API request / response shapes ────────────────────────────────────────────

/**
 * POST /api/timeblocks/:id/focus-sessions
 * Body: { mode?: FocusMode }  (mode defaults to "pomodoro_25_5" on backend)
 */
export interface StartSessionRequest {
  mode?: FocusMode;
}

/**
 * PATCH /api/timeblocks/:id/focus-sessions/:session_id/finish
 * Body: { duration_seconds: number }  (i32, >= 0)
 */
export interface FinishSessionRequest {
  duration_seconds: number;
}

/**
 * Params for listing sessions under a specific timeblock.
 * GET /api/timeblocks/:id/focus-sessions — blockId is mandatory.
 */
export interface FocusSessionsParams {
  blockId: string;
}

/**
 * Focus statistics derived from the dashboard stats endpoint.
 * GET /api/dashboard/stats returns QuickStats which contains
 * focus_minutes_today and pomodoro_sessions_today.
 */
export interface FocusStatsResponse {
  sessions_today: number;
  focus_minutes_today: number;
}
