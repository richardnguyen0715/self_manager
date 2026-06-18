"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS } from "@/types";
import type {
  WorkItem,
  WorkItemListItem,
  WorkItemSubtask,
  AgileListResponse,
} from "@/types";
import type {
  CreateWorkItemPayload,
  UpdateWorkItemPayload,
  SetWorkItemStatusPayload,
  SetWorkItemPointsPayload,
  MoveWorkItemToSprintPayload,
  MoveWorkItemToBacklogPayload,
  CreateWorkItemSubtaskPayload,
  UpdateWorkItemSubtaskPayload,
  WorkItemFiltersState,
} from "../types";

// ─── Query keys ───────────────────────────────────────────────────────────────

export const workItemKeys = {
  all: ["work-items"] as const,
  lists: () => [...workItemKeys.all, "list"] as const,
  list: (filters: WorkItemFiltersState) =>
    [...workItemKeys.lists(), filters] as const,
  details: () => [...workItemKeys.all, "detail"] as const,
  detail: (id: string) => [...workItemKeys.details(), id] as const,
  subtasks: (id: string) => [...workItemKeys.detail(id), "subtasks"] as const,
  backlog: (filters?: { epic_id?: string; project_id?: string | null }) =>
    ["backlog", filters] as const,
};

function filtersToParams(
  filters: WorkItemFiltersState,
): Record<string, string | number | boolean | undefined | null> {
  const p: Record<string, string | number | boolean | undefined | null> = {};
  if (filters.sprint_id) p.sprint_id = filters.sprint_id;
  if (filters.epic_id) p.epic_id = filters.epic_id;
  if (filters.project_id) p.project_id = filters.project_id;
  if (filters.status && filters.status !== "all") p.status = filters.status;
  if (filters.type && filters.type !== "all") p.type = filters.type;
  if (filters.priority && filters.priority !== "all") p.priority = filters.priority;
  if (filters.search) p.search = filters.search;
  if (filters.limit != null) p.limit = filters.limit;
  if (filters.offset != null) p.offset = filters.offset;
  return p;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useWorkItems(filters: WorkItemFiltersState = {}) {
  return useQuery({
    queryKey: workItemKeys.list(filters),
    queryFn: () =>
      api.get<AgileListResponse<WorkItemListItem>>(
        API_ENDPOINTS.WORK_ITEMS,
        filtersToParams(filters),
      ),
    placeholderData: keepPreviousData,
  });
}

export function useWorkItem(id: string) {
  return useQuery({
    queryKey: workItemKeys.detail(id),
    queryFn: () => api.get<WorkItem>(API_ENDPOINTS.WORK_ITEM_BY_ID(id)),
    enabled: Boolean(id),
  });
}

export function useWorkItemSubtasks(workItemId: string) {
  return useQuery({
    queryKey: workItemKeys.subtasks(workItemId),
    queryFn: () =>
      api.get<WorkItemSubtask[]>(API_ENDPOINTS.WORK_ITEM_SUBTASKS(workItemId)),
    enabled: Boolean(workItemId),
  });
}

export function useBacklog(filters?: { epic_id?: string; project_id?: string | null; limit?: number; offset?: number }) {
  return useQuery({
    queryKey: workItemKeys.backlog(filters),
    queryFn: () =>
      api.get<AgileListResponse<WorkItemListItem>>(
        API_ENDPOINTS.BACKLOG,
        filters as Record<string, string | number | boolean | undefined | null>,
      ),
    placeholderData: keepPreviousData,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function useCreateWorkItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateWorkItemPayload) =>
      api.post<WorkItem>(API_ENDPOINTS.WORK_ITEMS, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: workItemKeys.lists() });
      qc.invalidateQueries({ queryKey: ["backlog"] });
    },
  });
}

export function useUpdateWorkItem(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateWorkItemPayload) =>
      api.patch<WorkItem>(API_ENDPOINTS.WORK_ITEM_BY_ID(id), payload),
    onSuccess: (data) => {
      qc.setQueryData(workItemKeys.detail(id), data);
      qc.invalidateQueries({ queryKey: workItemKeys.lists() });
    },
  });
}

export function useDeleteWorkItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<void>(API_ENDPOINTS.WORK_ITEM_BY_ID(id)),
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: workItemKeys.detail(id) });
      qc.invalidateQueries({ queryKey: workItemKeys.lists() });
      qc.invalidateQueries({ queryKey: ["backlog"] });
    },
  });
}

export function useSetWorkItemStatus(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SetWorkItemStatusPayload) =>
      api.patch<WorkItem>(API_ENDPOINTS.WORK_ITEM_STATUS(id), payload),
    onSuccess: (data) => {
      qc.setQueryData(workItemKeys.detail(id), data);
      qc.invalidateQueries({ queryKey: workItemKeys.lists() });
      qc.invalidateQueries({ queryKey: ["sprints"] });
    },
  });
}

export function useSetWorkItemPoints(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SetWorkItemPointsPayload) =>
      api.patch<WorkItem>(API_ENDPOINTS.WORK_ITEM_POINTS(id), payload),
    onSuccess: (data) => {
      qc.setQueryData(workItemKeys.detail(id), data);
      qc.invalidateQueries({ queryKey: workItemKeys.lists() });
    },
  });
}

export function useMoveWorkItemToSprint(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: MoveWorkItemToSprintPayload) =>
      api.patch<WorkItem>(API_ENDPOINTS.WORK_ITEM_SPRINT(id), payload),
    onSuccess: (data) => {
      qc.setQueryData(workItemKeys.detail(id), data);
      qc.invalidateQueries({ queryKey: workItemKeys.lists() });
      qc.invalidateQueries({ queryKey: ["backlog"] });
      qc.invalidateQueries({ queryKey: ["sprints"] });
    },
  });
}

export function useMoveWorkItemToBacklog(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload?: MoveWorkItemToBacklogPayload) =>
      api.patch<WorkItem>(API_ENDPOINTS.WORK_ITEM_BACKLOG(id), payload ?? {}),
    onSuccess: (data) => {
      qc.setQueryData(workItemKeys.detail(id), data);
      qc.invalidateQueries({ queryKey: workItemKeys.lists() });
      qc.invalidateQueries({ queryKey: ["backlog"] });
      qc.invalidateQueries({ queryKey: ["sprints"] });
    },
  });
}

// ─── Subtask mutations ─────────────────────────────────────────────────────────

export function useCreateWorkItemSubtask(workItemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateWorkItemSubtaskPayload) =>
      api.post<WorkItemSubtask>(
        API_ENDPOINTS.WORK_ITEM_SUBTASKS(workItemId),
        payload,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: workItemKeys.subtasks(workItemId) });
      qc.invalidateQueries({ queryKey: workItemKeys.detail(workItemId) });
    },
  });
}

export function useUpdateWorkItemSubtask(workItemId: string, subtaskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateWorkItemSubtaskPayload) =>
      api.patch<WorkItemSubtask>(
        API_ENDPOINTS.WORK_ITEM_SUBTASK_BY_ID(workItemId, subtaskId),
        payload,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: workItemKeys.subtasks(workItemId) });
      qc.invalidateQueries({ queryKey: workItemKeys.detail(workItemId) });
    },
  });
}

export function useDeleteWorkItemSubtask(workItemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (subtaskId: string) =>
      api.delete<void>(
        API_ENDPOINTS.WORK_ITEM_SUBTASK_BY_ID(workItemId, subtaskId),
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: workItemKeys.subtasks(workItemId) });
      qc.invalidateQueries({ queryKey: workItemKeys.detail(workItemId) });
    },
  });
}
