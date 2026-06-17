// ─── Analytics-specific UI types (extends the global types in @/types) ──────────
// NOTE: API response shapes are imported directly from @/types.
// Only UI-level helpers live here.

export type DateRangePreset =
  | "last_7_days"
  | "last_30_days"
  | "this_week"
  | "this_month"
  | "last_3_months";

export interface DateRange {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
}

// Query param shape sent to analytics hooks.
// Backend uses `start` / `end` param names (YYYY-MM-DD).
export interface AnalyticsQueryParams {
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
}
