import {
  format,
  getHours,
  getMinutes,
  differenceInMinutes,
  isSameDay,
  parseISO,
  startOfDay,
  addMinutes,
} from "date-fns";
import type { CalendarEvent, TimeBlockSummary, Priority } from "@/types";

// ─── Constants ────────────────────────────────────────────────────────────────

export const HOUR_HEIGHT_PX = 64; // pixels per hour in day/week grid
export const DAY_START_HOUR = 0; // grid starts at midnight
export const DAY_TOTAL_HOURS = 24;
export const MIN_BLOCK_MINUTES = 15; // snap granularity

// ─── Time / position helpers ─────────────────────────────────────────────────

/** Converts a datetime to top-offset pixels in the day grid */
export function datetimeToTopPx(date: Date): number {
  const totalMinutes =
    (getHours(date) - DAY_START_HOUR) * 60 + getMinutes(date);
  return (totalMinutes / 60) * HOUR_HEIGHT_PX;
}

/** Converts a duration in minutes to a pixel height */
export function durationToHeightPx(minutes: number): number {
  return Math.max((minutes / 60) * HOUR_HEIGHT_PX, 20);
}

/** Given a pixel offset from the top of the grid, return the snapped minutes from DAY_START */
export function pxToMinutes(px: number): number {
  const raw = (px / HOUR_HEIGHT_PX) * 60;
  return Math.round(raw / MIN_BLOCK_MINUTES) * MIN_BLOCK_MINUTES;
}

/** Builds an ISO datetime from a base date and minutes-from-midnight offset */
export function minutesToDatetime(baseDate: Date, minutesFromMidnight: number): Date {
  return addMinutes(startOfDay(baseDate), minutesFromMidnight);
}

/** Format a short time label e.g. "9:30 AM" */
export function formatTimeLabel(date: Date): string {
  return format(date, "h:mm a");
}

/** Format a short hour label e.g. "9 AM" */
export function formatHourLabel(hour: number): string {
  if (hour === 0) return "12 AM";
  if (hour === 12) return "12 PM";
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
}

// ─── Event colour helpers ─────────────────────────────────────────────────────

const PRIORITY_COLORS: Record<Priority, { bg: string; border: string; text: string }> = {
  critical: {
    bg: "bg-red-100 dark:bg-red-900/40",
    border: "border-red-400 dark:border-red-600",
    text: "text-red-800 dark:text-red-200",
  },
  high: {
    bg: "bg-orange-100 dark:bg-orange-900/40",
    border: "border-orange-400 dark:border-orange-600",
    text: "text-orange-800 dark:text-orange-200",
  },
  medium: {
    bg: "bg-yellow-100 dark:bg-yellow-900/40",
    border: "border-yellow-400 dark:border-yellow-600",
    text: "text-yellow-800 dark:text-yellow-200",
  },
  low: {
    bg: "bg-blue-100 dark:bg-blue-900/40",
    border: "border-blue-400 dark:border-blue-600",
    text: "text-blue-800 dark:text-blue-200",
  },
};

export const EVENT_COLORS = {
  default: {
    bg: "bg-primary/15",
    border: "border-primary",
    text: "text-primary",
  },
  timeblock: {
    bg: "bg-violet-100 dark:bg-violet-900/40",
    border: "border-violet-400 dark:border-violet-600",
    text: "text-violet-800 dark:text-violet-200",
  },
};

export function getPriorityColors(priority: Priority) {
  return PRIORITY_COLORS[priority];
}

// ─── Layout: overlapping event columns ────────────────────────────────────────

export interface PositionedItem<T> {
  item: T;
  column: number;
  totalColumns: number;
  topPx: number;
  heightPx: number;
}

interface IntervalItem {
  start: Date;
  end: Date;
}

/**
 * Assigns column positions to events that overlap in time.
 * Returns the same array annotated with `column` and `totalColumns`.
 */
export function computeEventLayout<T extends IntervalItem>(
  items: T[],
): PositionedItem<T>[] {
  if (items.length === 0) return [];

  // Sort by start time
  const sorted = [...items].sort(
    (a, b) => a.start.getTime() - b.start.getTime(),
  );

  const result: PositionedItem<T>[] = sorted.map((item) => ({
    item,
    column: 0,
    totalColumns: 1,
    topPx: datetimeToTopPx(item.start),
    heightPx: durationToHeightPx(differenceInMinutes(item.end, item.start)),
  }));

  // Greedy column assignment
  const columnEnds: Date[] = [];

  for (const pos of result) {
    let assigned = false;
    for (let c = 0; c < columnEnds.length; c++) {
      if (pos.item.start >= columnEnds[c]) {
        pos.column = c;
        columnEnds[c] = pos.item.end;
        assigned = true;
        break;
      }
    }
    if (!assigned) {
      pos.column = columnEnds.length;
      columnEnds.push(pos.item.end);
    }
  }

  // Second pass: set totalColumns for all items in each overlap group
  for (let i = 0; i < result.length; i++) {
    let maxCol = result[i].column;
    // Find all items that overlap with result[i]
    for (let j = 0; j < result.length; j++) {
      if (i !== j) {
        const a = result[i].item;
        const b = result[j].item;
        if (a.start < b.end && b.start < a.end) {
          maxCol = Math.max(maxCol, result[j].column);
        }
      }
    }
    result[i].totalColumns = maxCol + 1;
  }

  return result;
}

// ─── Filter helpers ───────────────────────────────────────────────────────────

export function eventsForDay(events: CalendarEvent[], day: Date): CalendarEvent[] {
  // Match on the start day only. Recurrence is already expanded into one
  // occurrence per day, so an event must render exactly once — keying off the
  // span would duplicate a late event onto the next day when it crosses
  // midnight (e.g. a 10 PM–midnight block showing on both days).
  return events.filter((e) => isSameDay(parseISO(e.start_time), day));
}

export function timeBlocksForDay(blocks: TimeBlockSummary[], day: Date): TimeBlockSummary[] {
  return blocks.filter((b) => {
    const s = parseISO(b.start_time);
    return isSameDay(s, day);
  });
}

// ─── Hour labels ─────────────────────────────────────────────────────────────

export const HOURS: number[] = Array.from({ length: 24 }, (_, i) => i);
