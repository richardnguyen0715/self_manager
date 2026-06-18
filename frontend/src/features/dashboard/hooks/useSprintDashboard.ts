"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS } from "@/types";
import type { SprintDashboardResponse } from "@/types";

// GET /api/dashboard/sprint?date=YYYY-MM-DD (optional)
// Returns the sprint-centric dashboard payload.

export const SPRINT_DASHBOARD_KEY = ["dashboard", "sprint"] as const;

export function useSprintDashboard(date?: string) {
  return useQuery({
    queryKey: date ? [...SPRINT_DASHBOARD_KEY, date] : SPRINT_DASHBOARD_KEY,
    queryFn: () =>
      api.get<SprintDashboardResponse>(
        API_ENDPOINTS.DASHBOARD_SPRINT,
        date ? { date } : undefined,
      ),
    // Refresh every 3 minutes
    staleTime: 1000 * 60 * 3,
    placeholderData: (prev) => prev,
    // 404 = no active sprint; treat as partial data (null sprint), do not error
    retry: (failureCount, error) => {
      const status = (error as { status?: number }).status;
      if (status === 404) return false;
      return failureCount < 2;
    },
  });
}
