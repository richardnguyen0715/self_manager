"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS } from "@/types";
import type { Task, TaskListItem, Subtask } from "@/types";
import type {
  CreateTaskPayload,
  UpdateTaskPayload,
  CreateSubtaskPayload,
  UpdateSubtaskPayload,
  TaskFiltersState,
} from "../types";

// ─── Query keys ───────────────────────────────────────────────────────────────

export const taskKeys = {
  all: ["tasks"] as const,
  lists: () => [...taskKeys.all, "list"] as const,
  list: (filters: Partial<TaskFiltersState>) =>
    [...taskKeys.lists(), filters] as const,
  details: () => [...taskKeys.all, "detail"] as const,
  detail: (id: string) => [...taskKeys.details(), id] as const,
  subtasks: (taskId: string) => [...taskKeys.detail(taskId), "subtasks"] as const,
};

// ─── Build params from filters ────────────────────────────────────────────────

function filtersToParams(
  filters: Partial<TaskFiltersState>,
): Record<string, string | number | boolean | undefined | null> {
  const params: Record<string, string | number | boolean | undefined | null> =
    {};

  if (filters.search) params.search = filters.search;
  if (filters.status && filters.status !== "all") params.status = filters.status;
  if (filters.priority && filters.priority !== "all")
    params.priority = filters.priority;
  if (filters.project_id && filters.project_id !== "all")
    params.project_id = filters.project_id;
  if (filters.tag_id && filters.tag_id !== "all") params.tag_id = filters.tag_id;
  if (filters.due_filter && filters.due_filter !== "all")
    params.due_filter = filters.due_filter;
  if (filters.sort_by) params.sort_by = filters.sort_by;
  if (filters.sort_dir) params.sort_dir = filters.sort_dir;

  return params;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

/** Filtered task list — returns raw TaskListItem[]. */
export function useTasks(filters: Partial<TaskFiltersState> = {}) {
  return useQuery({
    queryKey: taskKeys.list(filters),
    queryFn: () =>
      api.get<TaskListItem[]>(API_ENDPOINTS.TASKS, filtersToParams(filters)),
    placeholderData: keepPreviousData,
  });
}

/** Single task with subtasks already embedded. Returns flat TaskResponse. */
export function useTask(id: string) {
  return useQuery({
    queryKey: taskKeys.detail(id),
    queryFn: () =>
      api.get<Task>(API_ENDPOINTS.TASK_BY_ID(id)),
    enabled: Boolean(id),
  });
}

/** Subtasks for a task. Returns raw Subtask[]. */
export function useSubtasks(taskId: string) {
  return useQuery({
    queryKey: taskKeys.subtasks(taskId),
    queryFn: () =>
      api.get<Subtask[]>(API_ENDPOINTS.TASK_SUBTASKS(taskId)),
    enabled: Boolean(taskId),
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateTaskPayload) =>
      api.post<Task>(API_ENDPOINTS.TASKS, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.lists() });
    },
  });
}

export function useUpdateTask(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateTaskPayload) =>
      api.patch<Task>(API_ENDPOINTS.TASK_BY_ID(taskId), payload),
    onSuccess: (data) => {
      qc.setQueryData(taskKeys.detail(taskId), data);
      qc.invalidateQueries({ queryKey: taskKeys.lists() });
    },
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) =>
      api.delete<void>(API_ENDPOINTS.TASK_BY_ID(taskId)),
    onSuccess: (_data, taskId) => {
      qc.removeQueries({ queryKey: taskKeys.detail(taskId) });
      qc.invalidateQueries({ queryKey: taskKeys.lists() });
    },
  });
}

/** Toggle task completion: completed <-> previous status. */
export function useToggleTaskComplete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      taskId,
      isCompleted,
    }: {
      taskId: string;
      isCompleted: boolean;
    }) =>
      api.patch<Task>(API_ENDPOINTS.TASK_BY_ID(taskId), {
        status: isCompleted ? "completed" : "in_progress",
      }),
    onSuccess: (_data, { taskId }) => {
      qc.invalidateQueries({ queryKey: taskKeys.detail(taskId) });
      qc.invalidateQueries({ queryKey: taskKeys.lists() });
    },
  });
}

// ─── Subtask mutations ─────────────────────────────────────────────────────────

export function useCreateSubtask(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSubtaskPayload) =>
      api.post<Subtask>(
        API_ENDPOINTS.TASK_SUBTASKS(taskId),
        payload,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.subtasks(taskId) });
      qc.invalidateQueries({ queryKey: taskKeys.detail(taskId) });
    },
  });
}

export function useUpdateSubtask(taskId: string, subtaskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateSubtaskPayload) =>
      api.patch<Subtask>(
        API_ENDPOINTS.TASK_SUBTASK_BY_ID(taskId, subtaskId),
        payload,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.subtasks(taskId) });
      qc.invalidateQueries({ queryKey: taskKeys.detail(taskId) });
    },
  });
}

export function useDeleteSubtask(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (subtaskId: string) =>
      api.delete<void>(
        API_ENDPOINTS.TASK_SUBTASK_BY_ID(taskId, subtaskId),
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.subtasks(taskId) });
      qc.invalidateQueries({ queryKey: taskKeys.detail(taskId) });
    },
  });
}
