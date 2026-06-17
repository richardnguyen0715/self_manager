import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Task, TaskListItem } from "@/types";

// ─── Query keys ───────────────────────────────────────────────────────────────

export const taskKeys = {
  unscheduled: ["tasks", "unscheduled"] as const,
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

/**
 * Fetches tasks that have no scheduled time block yet — these appear in the
 * "unscheduled tasks" panel and can be dragged onto the calendar to create a
 * time block.
 */
export function useUnscheduledTasks() {
  return useQuery({
    queryKey: taskKeys.unscheduled,
    queryFn: () =>
      api.get<TaskListItem[]>("/api/tasks", {
        status: "planned",
        limit: 100,
      }),
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * Quickly reschedule a task's due_date via PATCH /api/tasks/:id
 */
export function useRescheduleTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, due_date }: { id: string; due_date: string }) =>
      api.patch<Task>(`/api/tasks/${id}`, { due_date }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}
