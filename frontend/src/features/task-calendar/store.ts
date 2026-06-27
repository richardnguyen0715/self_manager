import { create } from "zustand";
import {
  startOfDay,
  addDays,
  addWeeks,
  addMonths,
  subDays,
  subWeeks,
  subMonths,
} from "date-fns";

// ─── Types ──────────────────────────────────────────────────────────────────

export type TaskCalendarViewMode = "day" | "week" | "month";

interface TaskCalendarState {
  view: TaskCalendarViewMode;
  /** Anchor date for the current view window. */
  anchorDate: Date;

  setView: (view: TaskCalendarViewMode) => void;
  goToToday: () => void;
  goToPrev: () => void;
  goToNext: () => void;
  goToDate: (date: Date) => void;
}

// ─── Store ──────────────────────────────────────────────────────────────────
//
// Navigation-only UI state for the project task-timeline. Task CRUD is driven
// by the shared task dialog store (useTaskUIStore), so there is no dialog state
// here. Kept separate from the personal calendar store so the two calendars
// navigate independently.

export const useTaskCalendarStore = create<TaskCalendarState>((set, get) => ({
  view: "week",
  anchorDate: startOfDay(new Date()),

  setView: (view) => set({ view }),

  goToToday: () => set({ anchorDate: startOfDay(new Date()) }),

  goToPrev: () => {
    const { view, anchorDate } = get();
    const next =
      view === "day"
        ? subDays(anchorDate, 1)
        : view === "week"
          ? subWeeks(anchorDate, 1)
          : subMonths(anchorDate, 1);
    set({ anchorDate: next });
  },

  goToNext: () => {
    const { view, anchorDate } = get();
    const next =
      view === "day"
        ? addDays(anchorDate, 1)
        : view === "week"
          ? addWeeks(anchorDate, 1)
          : addMonths(anchorDate, 1);
    set({ anchorDate: next });
  },

  goToDate: (date) => set({ anchorDate: startOfDay(date) }),
}));
