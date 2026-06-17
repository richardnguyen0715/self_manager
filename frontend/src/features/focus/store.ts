import { create } from "zustand";
import type { FocusSession, TaskListItem } from "@/types";
import type {
  FocusMode,
  TimerPhase,
  TimerState,
  FocusModeConfig,
} from "./types";
import { FOCUS_MODES } from "./types";

interface FocusStoreActions {
  // Mode & config
  setSelectedMode: (mode: FocusMode) => void;
  setCustomMinutes: (work: number, breakMins: number) => void;
  linkTask: (task: TaskListItem | null) => void;

  // Session lifecycle – called after server mutations succeed
  sessionStarted: (blockId: string, session: FocusSession) => void;
  sessionPaused: (session: FocusSession) => void;
  sessionResumed: (session: FocusSession) => void;
  sessionFinished: () => void;

  // Client-side tick (called by interval)
  tick: () => void;

  // Sync active session on mount / refocus
  syncActiveSession: (blockId: string, session: FocusSession | null) => void;

  // Break phase management
  startBreak: () => void;
  skipBreak: () => void;
}

type FocusStore = TimerState & FocusStoreActions;

function getConfigForMode(
  mode: FocusMode,
  customWork: number,
  customBreak: number,
): FocusModeConfig {
  if (mode === "custom") {
    return { mode, label: "Custom", workMinutes: customWork, breakMinutes: customBreak };
  }
  return FOCUS_MODES.find((m) => m.mode === mode)!;
}

export const useFocusStore = create<FocusStore>((set, get) => ({
  // ── initial state ─────────────────────────────────────────────────────────
  phase: "idle",
  activeSession: null,
  activeBlockId: null,
  selectedMode: "pomodoro_25_5",
  customWorkMinutes: 25,
  customBreakMinutes: 5,
  linkedTaskId: null,
  linkedTask: null,
  elapsedSeconds: 0,
  clientStartedAt: null,
  totalSeconds: 25 * 60,

  // ── mode / config ─────────────────────────────────────────────────────────
  setSelectedMode: (mode) => {
    const { customWorkMinutes, customBreakMinutes } = get();
    const cfg = getConfigForMode(mode, customWorkMinutes, customBreakMinutes);
    set({
      selectedMode: mode,
      totalSeconds: cfg.workMinutes * 60,
      elapsedSeconds: 0,
    });
  },

  setCustomMinutes: (work, breakMins) => {
    const { selectedMode } = get();
    set({
      customWorkMinutes: work,
      customBreakMinutes: breakMins,
      ...(selectedMode === "custom" && { totalSeconds: work * 60, elapsedSeconds: 0 }),
    });
  },

  linkTask: (task) =>
    set({ linkedTask: task, linkedTaskId: task?.id ?? null }),

  // ── session lifecycle ─────────────────────────────────────────────────────
  sessionStarted: (blockId, session) => {
    const { customWorkMinutes, customBreakMinutes } = get();
    const cfg = getConfigForMode(
      session.mode,
      customWorkMinutes,
      customBreakMinutes,
    );
    set({
      activeSession: session,
      activeBlockId: blockId,
      phase: "work",
      elapsedSeconds: 0,
      clientStartedAt: Date.now(),
      totalSeconds: cfg.workMinutes * 60,
      selectedMode: session.mode,
    });
  },

  sessionPaused: (session) => {
    const elapsed = computeElapsedSeconds(get());
    set({
      activeSession: session,
      phase: "work", // still work phase, just paused
      elapsedSeconds: elapsed,
      clientStartedAt: null, // no active tick
    });
  },

  sessionResumed: (session) => {
    set({
      activeSession: session,
      clientStartedAt: Date.now(),
    });
  },

  sessionFinished: () => {
    const { activeSession, customWorkMinutes, customBreakMinutes } = get();
    if (!activeSession) return;
    const cfg = getConfigForMode(
      activeSession.mode,
      customWorkMinutes,
      customBreakMinutes,
    );
    set({
      activeSession: null,
      activeBlockId: null,
      phase: "break",
      elapsedSeconds: 0,
      clientStartedAt: Date.now(),
      totalSeconds: cfg.breakMinutes * 60,
    });
  },

  // ── tick ─────────────────────────────────────────────────────────────────
  tick: () => {
    const state = get();
    if (!state.clientStartedAt) return;

    const elapsed = computeElapsedSeconds(state);
    const isBreakPhase = state.phase === "break";

    if (elapsed >= state.totalSeconds) {
      if (isBreakPhase) {
        set({ phase: "idle", elapsedSeconds: state.totalSeconds, clientStartedAt: null });
      } else {
        // Work phase auto-completed on client – show visual
        set({ elapsedSeconds: state.totalSeconds, clientStartedAt: null });
      }
    } else {
      set({ elapsedSeconds: elapsed });
    }
  },

  // ── break phase ───────────────────────────────────────────────────────────
  startBreak: () => {
    const { activeSession, customWorkMinutes, customBreakMinutes } = get();
    if (!activeSession && get().phase !== "break") return;
    const mode = activeSession?.mode ?? get().selectedMode;
    const cfg = getConfigForMode(mode, customWorkMinutes, customBreakMinutes);
    set({
      phase: "break",
      elapsedSeconds: 0,
      clientStartedAt: Date.now(),
      totalSeconds: cfg.breakMinutes * 60,
    });
  },

  skipBreak: () =>
    set({
      phase: "idle",
      elapsedSeconds: 0,
      clientStartedAt: null,
    }),

  // ── sync from server ──────────────────────────────────────────────────────
  syncActiveSession: (blockId, session) => {
    if (!session) {
      if (get().phase === "work") {
        set({
          activeSession: null,
          activeBlockId: null,
          phase: "idle",
          elapsedSeconds: 0,
          clientStartedAt: null,
        });
      }
      return;
    }

    const { customWorkMinutes, customBreakMinutes } = get();
    const cfg = getConfigForMode(
      session.mode,
      customWorkMinutes,
      customBreakMinutes,
    );

    // If session has ended_at it's already finished — treat as idle
    if (session.ended_at !== null) {
      set({
        activeSession: null,
        activeBlockId: null,
        phase: "idle",
        elapsedSeconds: 0,
        clientStartedAt: null,
      });
      return;
    }

    if (session.paused_at !== null) {
      // Paused: compute elapsed up to paused_at
      const serverStarted = new Date(session.started_at).getTime();
      const pausedAt = new Date(session.paused_at).getTime();
      const elapsed = Math.floor((pausedAt - serverStarted) / 1000);
      set({
        activeSession: session,
        activeBlockId: blockId,
        phase: "work",
        elapsedSeconds: Math.min(elapsed, cfg.workMinutes * 60),
        clientStartedAt: null,
        totalSeconds: cfg.workMinutes * 60,
        selectedMode: session.mode,
      });
    } else {
      // Active: compute elapsed from started_at to now
      const serverStarted = new Date(session.started_at).getTime();
      const elapsed = Math.floor((Date.now() - serverStarted) / 1000);
      set({
        activeSession: session,
        activeBlockId: blockId,
        phase: "work",
        elapsedSeconds: Math.min(elapsed, cfg.workMinutes * 60),
        clientStartedAt: Date.now() - elapsed * 1000,
        totalSeconds: cfg.workMinutes * 60,
        selectedMode: session.mode,
      });
    }
  },
}));

// ─── helpers ──────────────────────────────────────────────────────────────────

function computeElapsedSeconds(
  state: Pick<TimerState, "elapsedSeconds" | "clientStartedAt">,
): number {
  if (!state.clientStartedAt) return state.elapsedSeconds;
  const additional = Math.floor((Date.now() - state.clientStartedAt) / 1000);
  return state.elapsedSeconds + additional;
}
