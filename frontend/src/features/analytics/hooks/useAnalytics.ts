import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS } from "@/types";
import type {
  PeriodSummaryResponse,
  DailyStatPoint,
  TimeUsageResponse,
  CompletionRateResponse,
} from "@/types";
import type { AnalyticsQueryParams } from "../types";

// ─── Query keys ────────────────────────────────────────────────────────────────

export const analyticsKeys = {
  all: ["analytics"] as const,
  summary: (params: AnalyticsQueryParams) =>
    ["analytics", "summary", params] as const,
  daily: (params: AnalyticsQueryParams) =>
    ["analytics", "daily", params] as const,
  timeUsage: (params: AnalyticsQueryParams) =>
    ["analytics", "time-usage", params] as const,
  completionRate: (params: AnalyticsQueryParams) =>
    ["analytics", "completion-rate", params] as const,
};

// ─── Hooks ─────────────────────────────────────────────────────────────────────

/**
 * High-level KPI summary for the selected period.
 * GET /api/analytics/summary?start=&end=
 */
export function useAnalyticsSummary(params: AnalyticsQueryParams) {
  return useQuery({
    queryKey: analyticsKeys.summary(params),
    queryFn: () =>
      api.get<PeriodSummaryResponse>(API_ENDPOINTS.ANALYTICS_SUMMARY, {
        start: params.start,
        end: params.end,
      }),
    staleTime: 1000 * 60 * 5,
    placeholderData: (prev) => prev,
  });
}

/**
 * Per-day breakdown for charting.
 * GET /api/analytics/daily?start=&end=
 * Returns DailyStatPoint[] (raw array)
 */
export function useAnalyticsDaily(params: AnalyticsQueryParams) {
  return useQuery({
    queryKey: analyticsKeys.daily(params),
    queryFn: () =>
      api.get<DailyStatPoint[]>(API_ENDPOINTS.ANALYTICS_DAILY, {
        start: params.start,
        end: params.end,
      }),
    staleTime: 1000 * 60 * 5,
    placeholderData: (prev) => prev,
  });
}

/**
 * Focus time usage breakdown by day.
 * GET /api/analytics/time-usage?start=&end=
 * Returns flat TimeUsageResponse { start, end, total_focus_minutes, days }
 */
export function useTimeUsage(params: AnalyticsQueryParams) {
  return useQuery({
    queryKey: analyticsKeys.timeUsage(params),
    queryFn: () =>
      api.get<TimeUsageResponse>(API_ENDPOINTS.ANALYTICS_TIME_USAGE, {
        start: params.start,
        end: params.end,
      }),
    staleTime: 1000 * 60 * 5,
    placeholderData: (prev) => prev,
  });
}

/**
 * Task completion rate breakdown.
 * GET /api/analytics/completion-rate?start=&end=
 * Returns flat CompletionRateResponse { start, end, overall_task_completion_rate,
 *   active_days_rate, daily: DailyCompletionPoint[] }
 */
export function useCompletionRate(params: AnalyticsQueryParams) {
  return useQuery({
    queryKey: analyticsKeys.completionRate(params),
    queryFn: () =>
      api.get<CompletionRateResponse>(API_ENDPOINTS.ANALYTICS_COMPLETION_RATE, {
        start: params.start,
        end: params.end,
      }),
    staleTime: 1000 * 60 * 5,
    placeholderData: (prev) => prev,
  });
}
