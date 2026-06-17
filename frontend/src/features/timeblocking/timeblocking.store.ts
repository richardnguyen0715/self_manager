import { create } from "zustand";
import type { TimeBlock, FocusSession } from "@/types";

// ─── Local UI types ────────────────────────────────────────────────────────────

export type ViewMode = "day" | "week";

export interface DraftTimeBlock {
  title: string;
  task_id: string | null;
  start_time: string;
  end_time: string;
}

interface TimeBlockingState {
  // Navigation
  viewMode: ViewMode;
  selectedDate: string; // ISO date YYYY-MM-DD

  // Editor dialog
  editorOpen: boolean;
  editingBlock: TimeBlock | null; // null = create mode

  // Focus session panel
  focusPanelOpen: boolean;
  activeFocusSession: FocusSession | null;
  focusTimerElapsed: number; // seconds elapsed since last started_at

  // Inline drag-create
  draftBlock: DraftTimeBlock | null;

  // Selected block for detail/focus launch
  selectedBlockId: string | null;

  // Actions
  setViewMode: (mode: ViewMode) => void;
  setSelectedDate: (date: string) => void;

  openEditor: (block?: TimeBlock) => void;
  closeEditor: () => void;

  openFocusPanel: (session: FocusSession) => void;
  closeFocusPanel: () => void;
  setActiveFocusSession: (session: FocusSession | null) => void;
  tickFocusTimer: () => void;
  resetFocusTimer: () => void;

  setDraftBlock: (draft: DraftTimeBlock | null) => void;
  setSelectedBlockId: (id: string | null) => void;
}

export const useTimeBlockingStore = create<TimeBlockingState>((set) => ({
  viewMode: "day",
  selectedDate: new Date().toISOString().split("T")[0],

  editorOpen: false,
  editingBlock: null,

  focusPanelOpen: false,
  activeFocusSession: null,
  focusTimerElapsed: 0,

  draftBlock: null,
  selectedBlockId: null,

  // ── Navigation ──────────────────────────────────────────────────────────────
  setViewMode: (viewMode) => set({ viewMode }),
  setSelectedDate: (selectedDate) => set({ selectedDate }),

  // ── Editor ──────────────────────────────────────────────────────────────────
  openEditor: (block) =>
    set({ editorOpen: true, editingBlock: block ?? null }),
  closeEditor: () => set({ editorOpen: false, editingBlock: null }),

  // ── Focus session ────────────────────────────────────────────────────────────
  openFocusPanel: (session) =>
    set({ focusPanelOpen: true, activeFocusSession: session, focusTimerElapsed: 0 }),
  closeFocusPanel: () =>
    set({ focusPanelOpen: false, activeFocusSession: null, focusTimerElapsed: 0 }),
  setActiveFocusSession: (session) => set({ activeFocusSession: session }),
  tickFocusTimer: () =>
    set((s) => ({ focusTimerElapsed: s.focusTimerElapsed + 1 })),
  resetFocusTimer: () => set({ focusTimerElapsed: 0 }),

  // ── Draft block (drag-create) ────────────────────────────────────────────────
  setDraftBlock: (draftBlock) => set({ draftBlock }),

  // ── Selection ────────────────────────────────────────────────────────────────
  setSelectedBlockId: (selectedBlockId) => set({ selectedBlockId }),
}));
