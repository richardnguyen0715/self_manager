import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { DashboardResponse } from "@/types";

// GET /api/dashboard — returns today's tasks, habits, events, time-blocks
// and quick stats in one flat DashboardResponse.
// Optional ?date=YYYY-MM-DD defaults to today UTC on the backend.

const DASHBOARD_SUMMARY_KEY = ["dashboard", "summary"] as const;

export function useDashboardSummary() {
  return useQuery({
    queryKey: DASHBOARD_SUMMARY_KEY,
    queryFn: () =>
      api.get<DashboardResponse>("/api/dashboard"),
    // Refresh every 2 minutes; stats change as user completes tasks/habits
    staleTime: 1000 * 60 * 2,
    // Keep previous data visible while revalidating
    placeholderData: (prev) => prev,
  });
}

export { DASHBOARD_SUMMARY_KEY };
