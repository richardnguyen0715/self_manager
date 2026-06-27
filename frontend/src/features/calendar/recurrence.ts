// ─── Recurrence (lightweight RRULE subset) ──────────────────────────────────
//
// We store recurrence as an RFC-5545-ish RRULE string in
// `calendar_event.recurrence_rule` and expand it client-side within the visible
// range. Supported: FREQ=DAILY|WEEKLY|MONTHLY, INTERVAL, BYDAY (weekly), COUNT.
// "Permanent" = no COUNT.

import {
  addDays,
  addMonths,
  addWeeks,
  getDay,
  startOfDay,
  startOfWeek,
} from "date-fns";

export type RecurrenceFreq = "none" | "daily" | "weekly" | "monthly" | "custom";

/** Index 0..6 (Sun..Sat) → RRULE weekday token. */
const DAY_TOKENS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const;

export interface RecurrenceOptions {
  freq: RecurrenceFreq;
  /** Selected weekdays (0=Sun..6=Sat) for the "custom" weekly mode. */
  weekdays: number[];
  /** End mode. "never" = permanent; "count" = repeat N times total. */
  end: "never" | "count";
  count: number;
}

export const DEFAULT_RECURRENCE: RecurrenceOptions = {
  freq: "none",
  weekdays: [],
  end: "never",
  count: 10,
};

// ─── Build ─────────────────────────────────────────────────────────────────────

/** Serialise options to an RRULE string, or null when there is no recurrence. */
export function buildRRule(opts: RecurrenceOptions): string | null {
  if (opts.freq === "none") return null;

  const parts: string[] = [];
  if (opts.freq === "custom") {
    parts.push("FREQ=WEEKLY");
    const days = [...opts.weekdays].sort((a, b) => a - b).map((d) => DAY_TOKENS[d]);
    if (days.length) parts.push(`BYDAY=${days.join(",")}`);
  } else {
    parts.push(`FREQ=${opts.freq.toUpperCase()}`);
  }
  if (opts.end === "count" && opts.count > 0) {
    parts.push(`COUNT=${Math.floor(opts.count)}`);
  }
  return parts.join(";");
}

// ─── Parse ─────────────────────────────────────────────────────────────────────

/** Parse an RRULE string back into form options (best-effort). */
export function parseRRule(rule: string | null): RecurrenceOptions {
  if (!rule) return { ...DEFAULT_RECURRENCE };
  const map: Record<string, string> = {};
  for (const part of rule.split(";")) {
    const [k, v] = part.split("=");
    if (k && v) map[k.toUpperCase()] = v.toUpperCase();
  }
  const freqRaw = map.FREQ;
  const byday = map.BYDAY;
  let freq: RecurrenceFreq = "none";
  let weekdays: number[] = [];
  if (freqRaw === "DAILY") freq = "daily";
  else if (freqRaw === "MONTHLY") freq = "monthly";
  else if (freqRaw === "WEEKLY") {
    if (byday) {
      freq = "custom";
      weekdays = byday
        .split(",")
        .map((t) => DAY_TOKENS.indexOf(t.trim() as (typeof DAY_TOKENS)[number]))
        .filter((i) => i >= 0);
    } else {
      freq = "weekly";
    }
  }
  const count = map.COUNT ? Number(map.COUNT) : DEFAULT_RECURRENCE.count;
  return {
    freq,
    weekdays,
    end: map.COUNT ? "count" : "never",
    count: Number.isFinite(count) && count > 0 ? count : DEFAULT_RECURRENCE.count,
  };
}

// ─── Expand ─────────────────────────────────────────────────────────────────────

/** A safety cap so a malformed/permanent rule can't loop forever. */
const MAX_OCCURRENCES = 1000;

/**
 * Expand an anchor start date + RRULE into occurrence start dates that fall
 * within `[rangeStart, rangeEnd)`. Honours COUNT across the whole series (not
 * just the visible window).
 */
export function expandOccurrences(
  anchorStart: Date,
  rule: string | null,
  rangeStart: Date,
  rangeEnd: Date,
  excludedDates: string[] = [],
): Date[] {
  if (!rule) {
    // Non-recurring: include only if the anchor is inside the window.
    return anchorStart >= rangeStart && anchorStart < rangeEnd ? [anchorStart] : [];
  }

  const opts = parseRRule(rule);
  if (opts.freq === "none") {
    return anchorStart >= rangeStart && anchorStart < rangeEnd ? [anchorStart] : [];
  }

  // "Delete this and future" sets UNTIL on the rule; stop emitting at/after it.
  const untilRaw = rule
    .split(";")
    .map((p) => p.split("="))
    .find(([k]) => k.toUpperCase() === "UNTIL")?.[1];
  const until = untilRaw ? new Date(untilRaw) : null;

  // "Delete only this instance" stores excluded occurrence start instants.
  const excluded = new Set(
    excludedDates.map((d) => new Date(d).getTime()),
  );

  const limit = opts.end === "count" ? Math.min(opts.count, MAX_OCCURRENCES) : MAX_OCCURRENCES;
  const out: Date[] = [];

  const pushIfInRange = (d: Date) => {
    if (until && d >= until) return;
    if (excluded.has(d.getTime())) return;
    if (d >= rangeStart && d < rangeEnd) out.push(d);
  };

  // Preserve the anchor's time-of-day on every occurrence.
  const setTime = (base: Date): Date => {
    const d = new Date(base);
    d.setHours(
      anchorStart.getHours(),
      anchorStart.getMinutes(),
      anchorStart.getSeconds(),
      0,
    );
    return d;
  };

  let produced = 0;

  if (opts.freq === "custom" && opts.weekdays.length > 0) {
    // Iterate week by week from the anchor's week; emit each selected weekday.
    const days = [...opts.weekdays].sort((a, b) => a - b);
    let weekStart = startOfWeek(anchorStart, { weekStartsOn: 0 });
    let guard = 0;
    while (produced < limit && guard < MAX_OCCURRENCES * 7 && weekStart < rangeEnd) {
      for (const dow of days) {
        const occ = setTime(addDays(weekStart, dow));
        if (occ < anchorStart) continue; // series starts at the anchor
        if (produced >= limit) break;
        produced += 1;
        pushIfInRange(occ);
      }
      weekStart = addWeeks(weekStart, 1);
      guard += 1;
    }
    return out;
  }

  // DAILY / WEEKLY / MONTHLY: step from the anchor.
  let cursor = new Date(anchorStart);
  while (produced < limit && cursor < rangeEnd) {
    pushIfInRange(setTime(cursor));
    produced += 1;
    if (opts.freq === "daily") cursor = addDays(cursor, 1);
    else if (opts.freq === "weekly") cursor = addWeeks(cursor, 1);
    else cursor = addMonths(cursor, 1); // monthly
  }
  return out;
}

// Re-export for callers that want the token list (e.g. weekday checkboxes).
export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export { getDay, startOfDay };
