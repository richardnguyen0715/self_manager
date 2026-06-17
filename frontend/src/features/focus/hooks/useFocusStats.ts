import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { QuickStats } from "@/types";
import { API_ENDPOINTS } from "@/types";
import type { FocusStatsResponse } from "../types";
import { focusKeys } from "./useFocusSessions";

/**
 * Focus statistics derived from GET /api/dashboard/stats (QuickStats).
 * There is no dedicated /api/focus/stats endpoint on the backend.
 * We map the two focus-relevant fields into FocusStatsResponse.
 */
export function useFocusStats() {
  return useQuery<FocusStatsResponse>({
    queryKey: focusKeys.stats(),
    queryFn: () =>
      api
        .get<QuickStats>(API_ENDPOINTS.DASHBOARD_STATS)
        .then(
          (qs): FocusStatsResponse => ({
            sessions_today: qs.pomodoro_sessions_today,
            focus_minutes_today: qs.focus_minutes_today,
          }),
        ),
    staleTime: 1000 * 60 * 2, // 2 min
  });
}
