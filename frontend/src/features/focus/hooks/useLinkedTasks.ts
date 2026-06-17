import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { TaskListItem } from "@/types";
import { API_ENDPOINTS } from "@/types";

/**
 * Lightweight task list for the task-linker picker.
 * GET /api/tasks returns TaskListItem[] (raw array — no pagination envelope).
 * Filters to in_progress tasks with a limit of 20.
 * Note: the backend task list does not support full-text search; the `search`
 * param is used for client-side filtering only.
 */
export function useActiveTasks(search?: string) {
  return useQuery<TaskListItem[]>({
    queryKey: ["tasks", "active", search ?? ""],
    queryFn: () =>
      api.get<TaskListItem[]>(API_ENDPOINTS.TASKS, {
        status: "in_progress",
        limit: 20,
      }),
    staleTime: 1000 * 60,
    placeholderData: [],
    select: (items) =>
      search
        ? items.filter((t) =>
            t.title.toLowerCase().includes(search.toLowerCase()),
          )
        : items,
  });
}
