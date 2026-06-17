"use client";

import { create } from "zustand";
import type { DashboardPanel } from "./types";

// ─── Dashboard UI state ────────────────────────────────────────────────────────

interface DashboardUIState {
  /** Active panel tab in the Today panel */
  activePanel: DashboardPanel;
  /** Whether the quick-create task form is open */
  isQuickCreateOpen: boolean;
  /** Task id being marked complete optimistically (to show spinner/check) */
  pendingTaskIds: Set<string>;
  /** Habit id being logged optimistically */
  pendingHabitIds: Set<string>;

  // Actions
  setActivePanel: (panel: DashboardPanel) => void;
  openQuickCreate: () => void;
  closeQuickCreate: () => void;
  addPendingTask: (id: string) => void;
  removePendingTask: (id: string) => void;
  addPendingHabit: (id: string) => void;
  removePendingHabit: (id: string) => void;
}

export const useDashboardUIStore = create<DashboardUIState>((set) => ({
  activePanel: "tasks",
  isQuickCreateOpen: false,
  pendingTaskIds: new Set(),
  pendingHabitIds: new Set(),

  setActivePanel: (activePanel) => set({ activePanel }),

  openQuickCreate: () => set({ isQuickCreateOpen: true }),
  closeQuickCreate: () => set({ isQuickCreateOpen: false }),

  addPendingTask: (id) =>
    set((s) => ({ pendingTaskIds: new Set([...s.pendingTaskIds, id]) })),

  removePendingTask: (id) =>
    set((s) => {
      const next = new Set(s.pendingTaskIds);
      next.delete(id);
      return { pendingTaskIds: next };
    }),

  addPendingHabit: (id) =>
    set((s) => ({ pendingHabitIds: new Set([...s.pendingHabitIds, id]) })),

  removePendingHabit: (id) =>
    set((s) => {
      const next = new Set(s.pendingHabitIds);
      next.delete(id);
      return { pendingHabitIds: next };
    }),
}));
