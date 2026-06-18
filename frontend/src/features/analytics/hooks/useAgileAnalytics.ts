import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS } from "@/types";
import type {
  Sprint,
  VelocityPoint,
  BurndownResponse,
  EpicTimePoint,
  AgileListResponse,
} from "@/types";
import type { AnalyticsQueryParams } from "../types";

// ─── Query keys ────────────────────────────────────────────────────────────────

export const agileAnalyticsKeys = {
  all: ["analytics", "agile"] as const,
  velocity: (last: number) => ["analytics", "agile", "velocity", last] as const,
  burndown: (sprintId: string) =>
    ["analytics", "agile", "burndown", sprintId] as const,
  timeByEpic: (params: AnalyticsQueryParams) =>
    ["analytics", "agile", "time-by-epic", params] as const,
  sprintList: () => ["analytics", "agile", "sprint-list"] as const,
};

// ─── Hooks ─────────────────────────────────────────────────────────────────────

/**
 * Sprint velocity over the last N completed sprints.
 * GET /api/analytics/velocity?last=N
 * Returns { data: VelocityPoint[] }
 */
export function useSprintVelocity(last: number = 6) {
  return useQuery({
    queryKey: agileAnalyticsKeys.velocity(last),
    queryFn: () =>
      api.get<AgileListResponse<VelocityPoint>>(
        API_ENDPOINTS.ANALYTICS_VELOCITY,
        { last },
      ),
    staleTime: 1000 * 60 * 5,
    placeholderData: (prev) => prev,
  });
}

/**
 * Burndown chart data for a specific sprint.
 * GET /api/analytics/burndown?sprint_id=<id>
 * Returns flat BurndownResponse
 */
export function useSprintBurndown(sprintId: string | null) {
  return useQuery({
    queryKey: agileAnalyticsKeys.burndown(sprintId ?? ""),
    queryFn: () =>
      api.get<BurndownResponse>(API_ENDPOINTS.ANALYTICS_BURNDOWN, {
        sprint_id: sprintId!,
      }),
    enabled: Boolean(sprintId),
    staleTime: 1000 * 60 * 2,
    placeholderData: (prev) => prev,
  });
}

/**
 * Focus time logged per epic for a date window.
 * GET /api/analytics/time-by-epic?start=YYYY-MM-DD&end=YYYY-MM-DD
 * Returns { data: EpicTimePoint[] }
 */
export function useTimeByEpic(params: AnalyticsQueryParams) {
  return useQuery({
    queryKey: agileAnalyticsKeys.timeByEpic(params),
    queryFn: () =>
      api.get<AgileListResponse<EpicTimePoint>>(
        API_ENDPOINTS.ANALYTICS_TIME_BY_EPIC,
        { start: params.start, end: params.end },
      ),
    staleTime: 1000 * 60 * 5,
    placeholderData: (prev) => prev,
  });
}

/**
 * Lightweight sprint list used by the burndown sprint picker.
 * GET /api/sprints?limit=20
 * Returns { data: Sprint[], total }
 * Active sprint is listed first via client-side sort.
 */
export function useAnalyticsSprintList() {
  return useQuery({
    queryKey: agileAnalyticsKeys.sprintList(),
    queryFn: () =>
      api.get<AgileListResponse<Sprint>>(API_ENDPOINTS.SPRINTS, { limit: 20 }),
    staleTime: 1000 * 60 * 5,
    select: (response) => ({
      ...response,
      // Put active sprint first, then most recent completed
      data: [...(response.data ?? [])].sort((a, b) => {
        const order = { active: 0, planned: 1, completed: 2 } as const;
        const aOrder =
          order[a.status as keyof typeof order] ?? 3;
        const bOrder =
          order[b.status as keyof typeof order] ?? 3;
        return aOrder !== bOrder
          ? aOrder - bOrder
          : b.start_date.localeCompare(a.start_date);
      }),
    }),
  });
}
