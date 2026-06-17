import { create } from "zustand";
import { format, subDays, startOfWeek, endOfWeek } from "date-fns";
import type { DateRange, DateRangePreset } from "./types";

function toYMD(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

function rangeForPreset(preset: DateRangePreset): DateRange {
  const today = new Date();

  switch (preset) {
    case "last_7_days":
      return { from: toYMD(subDays(today, 6)), to: toYMD(today) };
    case "last_30_days":
      return { from: toYMD(subDays(today, 29)), to: toYMD(today) };
    case "this_week": {
      const weekStart = startOfWeek(today, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
      return { from: toYMD(weekStart), to: toYMD(weekEnd) };
    }
    case "this_month": {
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return { from: toYMD(monthStart), to: toYMD(monthEnd) };
    }
    case "last_3_months":
      return { from: toYMD(subDays(today, 89)), to: toYMD(today) };
    default:
      return { from: toYMD(subDays(today, 6)), to: toYMD(today) };
  }
}

interface AnalyticsState {
  preset: DateRangePreset;
  dateRange: DateRange;

  // Actions
  setPreset: (preset: DateRangePreset) => void;
  setCustomRange: (range: DateRange) => void;
}

export const useAnalyticsStore = create<AnalyticsState>((set) => ({
  preset: "last_7_days",
  dateRange: rangeForPreset("last_7_days"),

  setPreset: (preset) =>
    set({
      preset,
      dateRange: rangeForPreset(preset),
    }),

  setCustomRange: (dateRange) =>
    set({ dateRange, preset: "last_7_days" /* custom resets label */ }),
}));
