import { create } from "zustand";
import { persist } from "zustand/middleware";

/** 0 = Sunday, 1 = Monday (date-fns weekStartsOn). */
export type WeekStart = 0 | 1;

interface CalendarPrefsState {
  weekStartsOn: WeekStart;
  setWeekStartsOn: (w: WeekStart) => void;
}

/**
 * Persisted calendar display preferences shared by the Life Calendar and the
 * project task-timeline. Currently just the first day of the week.
 */
export const useCalendarPrefs = create<CalendarPrefsState>()(
  persist(
    (set) => ({
      weekStartsOn: 0,
      setWeekStartsOn: (weekStartsOn) => set({ weekStartsOn }),
    }),
    { name: "mml_calendar_prefs" },
  ),
);
