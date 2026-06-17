import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { TaskListItem } from "@/types";
import { API_ENDPOINTS } from "@/types";

// ─── Query key ────────────────────────────────────────────────────────────────

export const taskSelectorKeys = {
  all: ["tasks-selector"] as const,
  search: (q: string) => [...taskSelectorKeys.all, q] as const,
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Lightweight task list for the task-link combobox inside the time block editor.
 * Only fetches non-completed, non-archived tasks. Accepts an optional title filter.
 * GET /api/tasks returns TaskListItem[] (raw array).
 */
export function useTaskSelector(search: string = "") {
  return useQuery<TaskListItem[]>({
    queryKey: taskSelectorKeys.search(search),
    queryFn: () =>
      api.get<TaskListItem[]>(API_ENDPOINTS.TASKS, {
        status: "inbox,planned,in_progress,waiting",
        limit: 30,
        offset: 0,
      }),
    staleTime: 1000 * 60, // 1 minute
    placeholderData: (prev) => prev,
  });
}
