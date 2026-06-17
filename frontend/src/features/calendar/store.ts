import { create } from "zustand";
import {
  startOfMonth,
  startOfWeek,
  startOfDay,
  addDays,
  addWeeks,
  addMonths,
  subDays,
  subWeeks,
  subMonths,
} from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CalendarView = "day" | "week" | "month";

export interface DragState {
  taskId: string | null;
  /** ISO datetime string for where the drag currently hovers */
  hoverSlot: string | null;
}

interface CalendarUIState {
  view: CalendarView;
  /** The anchor date for the current view window */
  anchorDate: Date;
  /** Modal state for create/edit event dialog */
  eventDialogOpen: boolean;
  editingEventId: string | null;
  /** Pre-filled slot when clicking an empty slot to create */
  newEventStart: string | null;
  newEventEnd: string | null;
  /** Time block form modal */
  timeBlockDialogOpen: boolean;
  editingTimeBlockId: string | null;
  newTimeBlockStart: string | null;
  newTimeBlockEnd: string | null;
  /** Drag-to-create state */
  drag: DragState;

  // Actions
  setView: (view: CalendarView) => void;
  goToToday: () => void;
  goToPrev: () => void;
  goToNext: () => void;
  goToDate: (date: Date) => void;
  openEventDialog: (opts?: { start?: string; end?: string; id?: string }) => void;
  closeEventDialog: () => void;
  openTimeBlockDialog: (opts?: { start?: string; end?: string; id?: string }) => void;
  closeTimeBlockDialog: () => void;
  setDragHover: (taskId: string | null, slot: string | null) => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useCalendarStore = create<CalendarUIState>((set, get) => ({
  view: "week",
  anchorDate: startOfDay(new Date()),
  eventDialogOpen: false,
  editingEventId: null,
  newEventStart: null,
  newEventEnd: null,
  timeBlockDialogOpen: false,
  editingTimeBlockId: null,
  newTimeBlockStart: null,
  newTimeBlockEnd: null,
  drag: { taskId: null, hoverSlot: null },

  setView: (view) =>
    set({ view, anchorDate: startOfDay(new Date()) }),

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

  openEventDialog: (opts = {}) =>
    set({
      eventDialogOpen: true,
      editingEventId: opts.id ?? null,
      newEventStart: opts.start ?? null,
      newEventEnd: opts.end ?? null,
    }),

  closeEventDialog: () =>
    set({
      eventDialogOpen: false,
      editingEventId: null,
      newEventStart: null,
      newEventEnd: null,
    }),

  openTimeBlockDialog: (opts = {}) =>
    set({
      timeBlockDialogOpen: true,
      editingTimeBlockId: opts.id ?? null,
      newTimeBlockStart: opts.start ?? null,
      newTimeBlockEnd: opts.end ?? null,
    }),

  closeTimeBlockDialog: () =>
    set({
      timeBlockDialogOpen: false,
      editingTimeBlockId: null,
      newTimeBlockStart: null,
      newTimeBlockEnd: null,
    }),

  setDragHover: (taskId, hoverSlot) =>
    set({ drag: { taskId, hoverSlot } }),
}));

// ─── Selectors ────────────────────────────────────────────────────────────────

/** Returns the visible date range for the current view */
export function getViewRange(view: CalendarView, anchorDate: Date): { start: Date; end: Date } {
  switch (view) {
    case "day":
      return { start: startOfDay(anchorDate), end: startOfDay(addDays(anchorDate, 1)) };
    case "week": {
      const weekStart = startOfWeek(anchorDate, { weekStartsOn: 0 });
      return { start: weekStart, end: addDays(weekStart, 7) };
    }
    case "month": {
      const monthStart = startOfMonth(anchorDate);
      const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
      return { start: calStart, end: addDays(calStart, 42) };
    }
  }
}
