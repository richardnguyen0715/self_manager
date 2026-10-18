import { format, parseISO } from "date-fns";
import type { RetroSummary } from "./types";

/** Local calendar date as YYYY-MM-DD (what the open endpoint expects). */
export function todayISO(): string {
  return format(new Date(), "yyyy-MM-dd");
}

/** "Oct 19, 2026" for a single day, "Oct 12 – Oct 18, 2026" for a range. */
export function formatPeriod(
  period: Pick<RetroSummary, "period_start" | "period_end">,
): string {
  const start = parseISO(period.period_start);
  const end = parseISO(period.period_end);
  if (period.period_start === period.period_end) {
    return format(start, "MMM d, yyyy");
  }
  return `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}`;
}
