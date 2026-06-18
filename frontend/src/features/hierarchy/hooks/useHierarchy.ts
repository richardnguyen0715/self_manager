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
  Goal,
  GoalListResponse,
  Initiative,
  AgileListResponse,
  Epic,
  WorkItem,
  WorkItemListItem,
  WorkItemSubtask,
  InitiativeStatus,
  EpicStatus,
  WorkItemStatus,
  WorkItemType,
  Priority,
} from "@/types";

// ─── Query keys ───────────────────────────────────────────────────────────────

export const hierarchyKeys = {
  all: ["hierarchy"] as const,

  // Goals
  goals: () => [...hierarchyKeys.all, "goals"] as const,
  goalsList: (params: GoalListParams) =>
    [...hierarchyKeys.goals(), "list", params] as const,

  // Initiatives
  initiatives: () => [...hierarchyKeys.all, "initiatives"] as const,
  initiativesList: (params: InitiativeListParams) =>
    [...hierarchyKeys.initiatives(), "list", params] as const,
  initiativeDetail: (id: string) =>
    [...hierarchyKeys.initiatives(), "detail", id] as const,
  initiativeEpics: (initiativeId: string) =>
    [...hierarchyKeys.initiatives(), "detail", initiativeId, "epics"] as const,

  // Epics
  epics: () => [...hierarchyKeys.all, "epics"] as const,
  epicsList: (params: EpicListParams) =>
    [...hierarchyKeys.epics(), "list", params] as const,
  epicDetail: (id: string) =>
    [...hierarchyKeys.epics(), "detail", id] as const,
  epicWorkItems: (epicId: string) =>
    [...hierarchyKeys.epics(), "detail", epicId, "work-items"] as const,

  // Work items
  workItems: () => [...hierarchyKeys.all, "work-items"] as const,
  workItemsList: (params: WorkItemListParams) =>
    [...hierarchyKeys.workItems(), "list", params] as const,
  workItemDetail: (id: string) =>
    [...hierarchyKeys.workItems(), "detail", id] as const,
  workItemSubtasks: (workItemId: string) =>
    [...hierarchyKeys.workItems(), "detail", workItemId, "subtasks"] as const,
};

// ─── Param types ──────────────────────────────────────────────────────────────

export interface GoalListParams {
  status?: string;
  limit?: number;
  offset?: number;
}

export interface InitiativeListParams {
  goal_id?: string;
  status?: InitiativeStatus;
  limit?: number;
  offset?: number;
}

export interface EpicListParams {
  initiative_id?: string;
  status?: EpicStatus;
  limit?: number;
  offset?: number;
}

export interface WorkItemListParams {
  sprint_id?: string;
  epic_id?: string;
  status?: WorkItemStatus;
  type?: WorkItemType;
  priority?: Priority;
  limit?: number;
  offset?: number;
}

// ─── Payload types ────────────────────────────────────────────────────────────

export interface CreateInitiativePayload {
  goal_id: string;
  title: string;
  description?: string | null;
  status?: InitiativeStatus;
  color?: string | null;
  position?: number;
}

export interface UpdateInitiativePayload {
  title?: string;
  description?: string | null;
  status?: InitiativeStatus;
  color?: string | null;
  position?: number;
  goal_id?: string;
}

export interface CreateEpicPayload {
  initiative_id: string;
  title: string;
  description?: string | null;
  status?: EpicStatus;
  start_date?: string | null;
  due_date?: string | null;
  color?: string | null;
  position?: number;
}

export interface UpdateEpicPayload {
  initiative_id?: string;
  title?: string;
  description?: string | null;
  status?: EpicStatus;
  start_date?: string | null;
  due_date?: string | null;
  color?: string | null;
  position?: number;
}

export interface CreateWorkItemPayload {
  title: string;
  description?: string | null;
  type?: WorkItemType;
  epic_id?: string | null;
  sprint_id?: string | null;
  status?: WorkItemStatus;
  priority?: Priority;
  story_points?: number | null;
  due_date?: string | null;
  recurrence_rule?: string | null;
}

export interface UpdateWorkItemPayload extends Partial<CreateWorkItemPayload> {
  position?: number;
}

export interface CreateSubtaskPayload {
  title: string;
}

export interface UpdateSubtaskPayload {
  title?: string;
  is_done?: boolean;
  position?: number;
}

// ─── Goals hooks ──────────────────────────────────────────────────────────────

export function useGoalsList(params: GoalListParams = {}) {
  return useQuery({
    queryKey: hierarchyKeys.goalsList(params),
    queryFn: () =>
      api.get<GoalListResponse>(API_ENDPOINTS.GOALS, {
        status: params.status !== "all" ? params.status : undefined,
        limit: params.limit ?? 100,
        offset: params.offset ?? 0,
      }),
    placeholderData: keepPreviousData,
  });
}

// ─── Initiative hooks ─────────────────────────────────────────────────────────

export function useInitiatives(params: InitiativeListParams = {}) {
  return useQuery({
    queryKey: hierarchyKeys.initiativesList(params),
    queryFn: () =>
      api.get<AgileListResponse<Initiative>>(API_ENDPOINTS.INITIATIVES, {
        goal_id: params.goal_id,
        status: params.status,
        limit: params.limit ?? 100,
        offset: params.offset ?? 0,
      }),
    placeholderData: keepPreviousData,
  });
}

export function useInitiative(id: string) {
  return useQuery({
    queryKey: hierarchyKeys.initiativeDetail(id),
    queryFn: () => api.get<Initiative>(API_ENDPOINTS.INITIATIVE_BY_ID(id)),
    enabled: Boolean(id),
  });
}

export function useInitiativeEpics(initiativeId: string, enabled = true) {
  return useQuery({
    queryKey: hierarchyKeys.initiativeEpics(initiativeId),
    queryFn: () =>
      api.get<AgileListResponse<Epic>>(
        API_ENDPOINTS.INITIATIVE_EPICS(initiativeId),
      ),
    enabled: Boolean(initiativeId) && enabled,
  });
}

export function useCreateInitiative() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateInitiativePayload) =>
      api.post<Initiative>(API_ENDPOINTS.INITIATIVES, payload),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: hierarchyKeys.initiatives() });
      qc.invalidateQueries({
        queryKey: hierarchyKeys.initiativesList({ goal_id: variables.goal_id }),
      });
    },
  });
}

export function useUpdateInitiative() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...payload
    }: UpdateInitiativePayload & { id: string }) =>
      api.patch<Initiative>(API_ENDPOINTS.INITIATIVE_BY_ID(id), payload),
    onSuccess: (data) => {
      qc.setQueryData(hierarchyKeys.initiativeDetail(data.id), data);
      qc.invalidateQueries({ queryKey: hierarchyKeys.initiatives() });
    },
  });
}

export function useDeleteInitiative() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<void>(API_ENDPOINTS.INITIATIVE_BY_ID(id)),
    onSuccess: (_, id) => {
      qc.removeQueries({ queryKey: hierarchyKeys.initiativeDetail(id) });
      qc.invalidateQueries({ queryKey: hierarchyKeys.initiatives() });
    },
  });
}

// ─── Epic hooks ───────────────────────────────────────────────────────────────

export function useEpics(params: EpicListParams = {}) {
  return useQuery({
    queryKey: hierarchyKeys.epicsList(params),
    queryFn: () =>
      api.get<AgileListResponse<Epic>>(API_ENDPOINTS.EPICS, {
        initiative_id: params.initiative_id,
        status: params.status,
        limit: params.limit ?? 100,
        offset: params.offset ?? 0,
      }),
    placeholderData: keepPreviousData,
  });
}

export function useEpic(id: string) {
  return useQuery({
    queryKey: hierarchyKeys.epicDetail(id),
    queryFn: () => api.get<Epic>(API_ENDPOINTS.EPIC_BY_ID(id)),
    enabled: Boolean(id),
  });
}

export function useEpicWorkItems(epicId: string, enabled = true) {
  return useQuery({
    queryKey: hierarchyKeys.epicWorkItems(epicId),
    queryFn: () =>
      api.get<AgileListResponse<WorkItemListItem>>(
        API_ENDPOINTS.EPIC_WORK_ITEMS(epicId),
      ),
    enabled: Boolean(epicId) && enabled,
  });
}

export function useCreateEpic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateEpicPayload) =>
      api.post<Epic>(API_ENDPOINTS.EPICS, payload),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: hierarchyKeys.epics() });
      qc.invalidateQueries({
        queryKey: hierarchyKeys.initiativeEpics(variables.initiative_id),
      });
    },
  });
}

export function useUpdateEpic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: UpdateEpicPayload & { id: string }) =>
      api.patch<Epic>(API_ENDPOINTS.EPIC_BY_ID(id), payload),
    onSuccess: (data) => {
      qc.setQueryData(hierarchyKeys.epicDetail(data.id), data);
      qc.invalidateQueries({ queryKey: hierarchyKeys.epics() });
    },
  });
}

export function useDeleteEpic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(API_ENDPOINTS.EPIC_BY_ID(id)),
    onSuccess: (_, id) => {
      qc.removeQueries({ queryKey: hierarchyKeys.epicDetail(id) });
      qc.invalidateQueries({ queryKey: hierarchyKeys.epics() });
    },
  });
}

// ─── Work item hooks ──────────────────────────────────────────────────────────

export function useWorkItems(params: WorkItemListParams = {}) {
  return useQuery({
    queryKey: hierarchyKeys.workItemsList(params),
    queryFn: () =>
      api.get<AgileListResponse<WorkItemListItem>>(API_ENDPOINTS.WORK_ITEMS, {
        sprint_id: params.sprint_id,
        epic_id: params.epic_id,
        status: params.status,
        type: params.type,
        priority: params.priority,
        limit: params.limit ?? 100,
        offset: params.offset ?? 0,
      }),
    placeholderData: keepPreviousData,
  });
}

export function useWorkItem(id: string) {
  return useQuery({
    queryKey: hierarchyKeys.workItemDetail(id),
    queryFn: () => api.get<WorkItem>(API_ENDPOINTS.WORK_ITEM_BY_ID(id)),
    enabled: Boolean(id),
  });
}

export function useWorkItemSubtasks(workItemId: string, enabled = true) {
  return useQuery({
    queryKey: hierarchyKeys.workItemSubtasks(workItemId),
    queryFn: () =>
      api.get<WorkItemSubtask[]>(API_ENDPOINTS.WORK_ITEM_SUBTASKS(workItemId)),
    enabled: Boolean(workItemId) && enabled,
  });
}

export function useCreateWorkItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateWorkItemPayload) =>
      api.post<WorkItem>(API_ENDPOINTS.WORK_ITEMS, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: hierarchyKeys.workItems() });
      qc.invalidateQueries({ queryKey: hierarchyKeys.epics() });
    },
  });
}

export function useUpdateWorkItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: UpdateWorkItemPayload & { id: string }) =>
      api.patch<WorkItem>(API_ENDPOINTS.WORK_ITEM_BY_ID(id), payload),
    onSuccess: (data) => {
      qc.setQueryData(hierarchyKeys.workItemDetail(data.id), data);
      qc.invalidateQueries({ queryKey: hierarchyKeys.workItems() });
    },
  });
}

export function useSetWorkItemStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: WorkItemStatus }) =>
      api.patch<WorkItem>(API_ENDPOINTS.WORK_ITEM_STATUS(id), { status }),
    onSuccess: (data) => {
      qc.setQueryData(hierarchyKeys.workItemDetail(data.id), data);
      qc.invalidateQueries({ queryKey: hierarchyKeys.workItems() });
      qc.invalidateQueries({ queryKey: hierarchyKeys.epics() });
    },
  });
}

export function useDeleteWorkItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<void>(API_ENDPOINTS.WORK_ITEM_BY_ID(id)),
    onSuccess: (_, id) => {
      qc.removeQueries({ queryKey: hierarchyKeys.workItemDetail(id) });
      qc.invalidateQueries({ queryKey: hierarchyKeys.workItems() });
      qc.invalidateQueries({ queryKey: hierarchyKeys.epics() });
    },
  });
}

// ─── Subtask mutations ─────────────────────────────────────────────────────────

export function useCreateWorkItemSubtask(workItemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSubtaskPayload) =>
      api.post<WorkItemSubtask>(
        API_ENDPOINTS.WORK_ITEM_SUBTASKS(workItemId),
        payload,
      ),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: hierarchyKeys.workItemSubtasks(workItemId),
      });
      qc.invalidateQueries({
        queryKey: hierarchyKeys.workItemDetail(workItemId),
      });
    },
  });
}

export function useUpdateWorkItemSubtask(workItemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      subtaskId,
      ...payload
    }: UpdateSubtaskPayload & { subtaskId: string }) =>
      api.patch<WorkItemSubtask>(
        API_ENDPOINTS.WORK_ITEM_SUBTASK_BY_ID(workItemId, subtaskId),
        payload,
      ),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: hierarchyKeys.workItemSubtasks(workItemId),
      });
      qc.invalidateQueries({
        queryKey: hierarchyKeys.workItemDetail(workItemId),
      });
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
      qc.invalidateQueries({
        queryKey: hierarchyKeys.workItemSubtasks(workItemId),
      });
      qc.invalidateQueries({
        queryKey: hierarchyKeys.workItemDetail(workItemId),
      });
    },
  });
}
