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
  Sprint,
  SprintReview,
  Retrospective,
  BurndownResponse,
  VelocityPoint,
  WorkItemListItem,
  AgileListResponse,
} from "@/types";
import type {
  CreateSprintPayload,
  UpdateSprintPayload,
  CompleteSprintPayload,
  UpsertSprintReviewPayload,
  UpsertRetrospectivePayload,
} from "../types";

// ─── Query keys ───────────────────────────────────────────────────────────────

export const sprintKeys = {
  all: ["sprints"] as const,
  lists: () => [...sprintKeys.all, "list"] as const,
  list: (filters?: { status?: string; project_id?: string | null }) =>
    [...sprintKeys.lists(), filters] as const,
  details: () => [...sprintKeys.all, "detail"] as const,
  detail: (id: string) => [...sprintKeys.details(), id] as const,
  active: () => [...sprintKeys.all, "active"] as const,
  workItems: (id: string) => [...sprintKeys.detail(id), "work-items"] as const,
  burndown: (id: string) => [...sprintKeys.detail(id), "burndown"] as const,
  review: (id: string) => [...sprintKeys.detail(id), "review"] as const,
  retro: (id: string) => [...sprintKeys.detail(id), "retro"] as const,
  velocity: (last?: number) => [...sprintKeys.all, "velocity", last] as const,
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useSprints(filters?: { status?: string; project_id?: string | null; limit?: number; offset?: number }) {
  return useQuery({
    queryKey: sprintKeys.list(filters),
    queryFn: () =>
      api.get<AgileListResponse<Sprint>>(
        API_ENDPOINTS.SPRINTS,
        filters as Record<string, string | number | boolean | undefined | null>,
      ),
    placeholderData: keepPreviousData,
  });
}

export function useSprint(id: string) {
  return useQuery({
    queryKey: sprintKeys.detail(id),
    queryFn: () => api.get<Sprint>(API_ENDPOINTS.SPRINT_BY_ID(id)),
    enabled: Boolean(id),
  });
}

export function useActiveSprint() {
  return useQuery({
    queryKey: sprintKeys.active(),
    queryFn: () => api.get<Sprint>(API_ENDPOINTS.SPRINT_ACTIVE),
    // 404 means no active sprint — treat as null, do not surface error
    retry: (failureCount, error) => {
      const status = (error as { status?: number }).status;
      if (status === 404) return false;
      return failureCount < 2;
    },
  });
}

export function useSprintWorkItems(sprintId: string, filters?: { status?: string }) {
  return useQuery({
    queryKey: sprintKeys.workItems(sprintId),
    queryFn: () =>
      api.get<AgileListResponse<WorkItemListItem>>(
        API_ENDPOINTS.SPRINT_WORK_ITEMS(sprintId),
        filters as Record<string, string | number | boolean | undefined | null>,
      ),
    enabled: Boolean(sprintId),
  });
}

export function useSprintBurndown(sprintId: string) {
  return useQuery({
    queryKey: sprintKeys.burndown(sprintId),
    queryFn: () =>
      api.get<BurndownResponse>(API_ENDPOINTS.SPRINT_BURNDOWN(sprintId)),
    enabled: Boolean(sprintId),
  });
}

export function useSprintReview(sprintId: string) {
  return useQuery({
    queryKey: sprintKeys.review(sprintId),
    queryFn: () =>
      api.get<SprintReview>(API_ENDPOINTS.SPRINT_REVIEW(sprintId)),
    enabled: Boolean(sprintId),
    retry: (failureCount, error) => {
      const status = (error as { status?: number }).status;
      if (status === 404) return false;
      return failureCount < 2;
    },
  });
}

export function useSprintRetro(sprintId: string) {
  return useQuery({
    queryKey: sprintKeys.retro(sprintId),
    queryFn: () =>
      api.get<Retrospective>(API_ENDPOINTS.SPRINT_RETRO(sprintId)),
    enabled: Boolean(sprintId),
    retry: (failureCount, error) => {
      const status = (error as { status?: number }).status;
      if (status === 404) return false;
      return failureCount < 2;
    },
  });
}

export function useSprintVelocity(last = 6) {
  return useQuery({
    queryKey: sprintKeys.velocity(last),
    queryFn: () =>
      api.get<{ data: VelocityPoint[] }>(API_ENDPOINTS.SPRINT_VELOCITY, {
        last,
      }),
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function useCreateSprint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSprintPayload) =>
      api.post<Sprint>(API_ENDPOINTS.SPRINTS, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: sprintKeys.lists() });
    },
  });
}

export function useUpdateSprint(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateSprintPayload) =>
      api.patch<Sprint>(API_ENDPOINTS.SPRINT_BY_ID(id), payload),
    onSuccess: (data) => {
      qc.setQueryData(sprintKeys.detail(id), data);
      qc.invalidateQueries({ queryKey: sprintKeys.lists() });
    },
  });
}

export function useDeleteSprint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<void>(API_ENDPOINTS.SPRINT_BY_ID(id)),
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: sprintKeys.detail(id) });
      qc.invalidateQueries({ queryKey: sprintKeys.lists() });
    },
  });
}

export function useActivateSprint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<Sprint>(API_ENDPOINTS.SPRINT_ACTIVATE(id)),
    onSuccess: (data) => {
      qc.setQueryData(sprintKeys.detail(data.id), data);
      qc.invalidateQueries({ queryKey: sprintKeys.active() });
      qc.invalidateQueries({ queryKey: sprintKeys.lists() });
    },
  });
}

export function useCompleteSprint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload?: CompleteSprintPayload }) =>
      api.post<SprintReview>(API_ENDPOINTS.SPRINT_COMPLETE(id), payload ?? {}),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: sprintKeys.detail(id) });
      qc.invalidateQueries({ queryKey: sprintKeys.active() });
      qc.invalidateQueries({ queryKey: sprintKeys.lists() });
      qc.invalidateQueries({ queryKey: sprintKeys.review(id) });
    },
  });
}

export function useUpsertSprintReview(sprintId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpsertSprintReviewPayload) =>
      api.put<SprintReview>(API_ENDPOINTS.SPRINT_REVIEW(sprintId), payload),
    onSuccess: (data) => {
      qc.setQueryData(sprintKeys.review(sprintId), data);
    },
  });
}

export function useUpsertRetrospective(sprintId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpsertRetrospectivePayload) =>
      api.put<Retrospective>(API_ENDPOINTS.SPRINT_RETRO(sprintId), payload),
    onSuccess: (data) => {
      qc.setQueryData(sprintKeys.retro(sprintId), data);
    },
  });
}
