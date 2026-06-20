"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS } from "@/types";
import type { SprintDashboardResponse } from "@/types";

// GET /api/dashboard/sprint?date=YYYY-MM-DD (optional)
// Returns the sprint-centric dashboard payload.

export const SPRINT_DASHBOARD_KEY = ["dashboard", "sprint"] as const;

/** Empty-sprint fallback returned when the backend 404s (no active sprint). */
const NO_SPRINT_FALLBACK: SprintDashboardResponse = {
  active_sprint: null,
  sprint_progress_pct: 0,
  goal_progress: [],
  today_time_blocks: [],
  overdue_work_items: [],
  habits: [],
};

export function useSprintDashboard(date?: string) {
  return useQuery({
    queryKey: date ? [...SPRINT_DASHBOARD_KEY, date] : SPRINT_DASHBOARD_KEY,
    queryFn: async () => {
      try {
        return await api.get<SprintDashboardResponse>(
          API_ENDPOINTS.DASHBOARD_SPRINT,
          date ? { date } : undefined,
        );
      } catch (err) {
        // 404 means no active sprint — return a clean empty state instead of
        // propagating an error that would show the "Something went wrong" card.
        const status = (err as { status?: number }).status;
        if (status === 404) return NO_SPRINT_FALLBACK;
        throw err;
      }
    },
    // Refresh every 3 minutes
    staleTime: 1000 * 60 * 3,
    placeholderData: (prev) => prev,
    retry: (failureCount, error) => {
      const status = (error as { status?: number }).status;
      if (status === 404) return false;
      return failureCount < 2;
    },
  });
}
