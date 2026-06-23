"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS } from "@/types";
import type { TrashResponse } from "@/types";

/** Query key for the trash aggregator. */
export const trashKeys = {
  all: ["trash"] as const,
};

/**
 * GET /api/trash → { work_items, tasks, projects } (soft-deleted rows,
 * newest deleted first).
 */
export function useTrash() {
  return useQuery({
    queryKey: trashKeys.all,
    queryFn: () => api.get<TrashResponse>(API_ENDPOINTS.TRASH),
    staleTime: 1000 * 30,
  });
}

/**
 * After a restore/purge we invalidate every list that a soft-deleted row could
 * (re)appear in or vanish from. Restored work items / tasks / projects must
 * resurface in their normal views; purged ones must stay gone everywhere.
 */
function invalidateEverything(qc: ReturnType<typeof useQueryClient>) {
  // Work item lists + board
  qc.invalidateQueries({ queryKey: ["work-items"] });
  // Backlog screen + sprint sections
  qc.invalidateQueries({ queryKey: ["backlog"] });
  qc.invalidateQueries({ queryKey: ["sprints"] });
  // Task lists (kanban / lists)
  qc.invalidateQueries({ queryKey: ["tasks"] });
  // Project lists / dropdowns
  qc.invalidateQueries({ queryKey: ["projects"] });
  // The trash view itself
  qc.invalidateQueries({ queryKey: trashKeys.all });
}

// ─── Work items ─────────────────────────────────────────────────────────────

/** POST /api/work-items/:id/restore */
export function useRestoreWorkItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<void>(API_ENDPOINTS.WORK_ITEM_RESTORE(id)),
    onSuccess: () => invalidateEverything(qc),
  });
}

/** DELETE /api/work-items/:id/purge — permanent */
export function usePurgeWorkItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<void>(API_ENDPOINTS.WORK_ITEM_PURGE(id)),
    onSuccess: () => invalidateEverything(qc),
  });
}

// ─── Tasks ──────────────────────────────────────────────────────────────────

/** POST /api/tasks/:id/restore */
export function useRestoreTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<void>(API_ENDPOINTS.TASK_RESTORE(id)),
    onSuccess: () => invalidateEverything(qc),
  });
}

/** DELETE /api/tasks/:id/purge — permanent */
export function usePurgeTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(API_ENDPOINTS.TASK_PURGE(id)),
    onSuccess: () => invalidateEverything(qc),
  });
}

// ─── Projects ─────────────────────────────────────────────────────────────────

/** POST /api/projects/:id/restore */
export function useRestoreProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<void>(API_ENDPOINTS.PROJECT_RESTORE(id)),
    onSuccess: () => invalidateEverything(qc),
  });
}

/** DELETE /api/projects/:id/purge — permanent (cascades subtasks/work items) */
export function usePurgeProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<void>(API_ENDPOINTS.PROJECT_PURGE(id)),
    onSuccess: () => invalidateEverything(qc),
  });
}
