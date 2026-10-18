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
  WorkItem,
} from "@/types";
import type {
  SprintFiltersState,
  UnfinishedItemsAction,
  CompleteSprintResult,
} from "../types";

// ─── Query keys ───────────────────────────────────────────────────────────────

export const sprintFeatureKeys = {
  all: ["sprints-feature"] as const,
  lists: () => [...sprintFeatureKeys.all, "list"] as const,
  list: (filters: SprintFiltersState & { project_id?: string | null }) =>
    [...sprintFeatureKeys.lists(), filters] as const,
  details: () => [...sprintFeatureKeys.all, "detail"] as const,
  detail: (id: string) => [...sprintFeatureKeys.details(), id] as const,
  active: () => [...sprintFeatureKeys.all, "active"] as const,
  workItems: (id: string) =>
    [...sprintFeatureKeys.detail(id), "work-items"] as const,
  burndown: (id: string) =>
    [...sprintFeatureKeys.detail(id), "burndown"] as const,
  review: (id: string) =>
    [...sprintFeatureKeys.detail(id), "review"] as const,
  retro: (id: string) =>
    [...sprintFeatureKeys.detail(id), "retro"] as const,
  velocity: (last: number) =>
    [...sprintFeatureKeys.all, "velocity", last] as const,
  backlog: () => ["backlog"] as const,
};

// ─── Query hooks ──────────────────────────────────────────────────────────────

/** List all sprints — GET /api/sprints?status?&project_id?&limit?&offset?
 *  Response: { data: Sprint[], total }
 */
export function useSprintsList(
  filters: SprintFiltersState & { project_id?: string | null } = {},
  opts?: { limit?: number; offset?: number },
) {
  const params: Record<string, string | number | undefined | null> = {};
  if (filters.status && filters.status !== "all") params.status = filters.status;
  if (filters.project_id) params.project_id = filters.project_id;
  if (opts?.limit != null) params.limit = opts.limit;
  if (opts?.offset != null) params.offset = opts.offset;

  return useQuery({
    queryKey: sprintFeatureKeys.list(filters),
    queryFn: () =>
      api.get<AgileListResponse<Sprint>>(
        API_ENDPOINTS.SPRINTS,
        params as Record<string, string | number | boolean | undefined | null>,
      ),
    placeholderData: keepPreviousData,
  });
}

/** Single sprint with derived fields — GET /api/sprints/:id
 *  Response: flat Sprint (includes planned_points, committed_count, done_count)
 */
export function useSprintDetail(id: string) {
  return useQuery({
    queryKey: sprintFeatureKeys.detail(id),
    queryFn: () => api.get<Sprint>(API_ENDPOINTS.SPRINT_BY_ID(id)),
    enabled: Boolean(id),
  });
}

/** Active sprint — GET /api/sprints/active
 *  Returns flat Sprint or 404 (treated as null).
 */
export function useActiveSprint() {
  return useQuery({
    queryKey: sprintFeatureKeys.active(),
    queryFn: () => api.get<Sprint>(API_ENDPOINTS.SPRINT_ACTIVE),
    retry: (failureCount, error) => {
      const status = (error as { status?: number }).status;
      if (status === 404) return false;
      return failureCount < 2;
    },
  });
}

/** Sprint work items — GET /api/sprints/:id/work-items?status?
 *  Response: { data: WorkItemListItem[], total }
 */
export function useSprintWorkItemsList(
  sprintId: string,
  filters?: { status?: string },
) {
  return useQuery({
    queryKey: sprintFeatureKeys.workItems(sprintId),
    queryFn: () =>
      api.get<AgileListResponse<WorkItemListItem>>(
        API_ENDPOINTS.SPRINT_WORK_ITEMS(sprintId),
        filters as Record<string, string | number | boolean | undefined | null>,
      ),
    enabled: Boolean(sprintId),
  });
}

/** Sprint burndown chart — GET /api/sprints/:id/burndown
 *  Response: flat BurndownResponse
 */
export function useSprintBurndownData(sprintId: string) {
  return useQuery({
    queryKey: sprintFeatureKeys.burndown(sprintId),
    queryFn: () =>
      api.get<BurndownResponse>(API_ENDPOINTS.SPRINT_BURNDOWN(sprintId)),
    enabled: Boolean(sprintId),
  });
}

/** Sprint review — GET /api/sprints/:id/review
 *  Response: flat SprintReview or 404.
 */
export function useSprintReviewData(sprintId: string) {
  return useQuery({
    queryKey: sprintFeatureKeys.review(sprintId),
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

/** Sprint retrospective — GET /api/sprints/:id/retrospective
 *  Response: flat Retrospective or 404.
 */
export function useSprintRetroData(sprintId: string) {
  return useQuery({
    queryKey: sprintFeatureKeys.retro(sprintId),
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

/** Velocity chart — GET /api/sprints/velocity?last=6
 *  Response: { data: VelocityPoint[] }
 */
export function useVelocityChart(last = 6) {
  return useQuery({
    queryKey: sprintFeatureKeys.velocity(last),
    queryFn: () =>
      api.get<{ data: VelocityPoint[] }>(API_ENDPOINTS.SPRINT_VELOCITY, {
        last,
      }),
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export interface CreateSprintPayload {
  name: string;
  goal_text?: string | null;
  start_date: string;
  end_date: string;
  capacity_points?: number;
  project_id?: string | null;
}

export function useCreateSprint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSprintPayload) =>
      api.post<Sprint>(API_ENDPOINTS.SPRINTS, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: sprintFeatureKeys.lists() });
    },
  });
}

export interface UpdateSprintPayload extends Partial<CreateSprintPayload> {
  status?: string;
}

export function useUpdateSprint(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateSprintPayload) =>
      api.patch<Sprint>(API_ENDPOINTS.SPRINT_BY_ID(id), payload),
    onSuccess: (data) => {
      qc.setQueryData(sprintFeatureKeys.detail(id), data);
      qc.invalidateQueries({ queryKey: sprintFeatureKeys.lists() });
    },
  });
}

export function useDeleteSprint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<void>(API_ENDPOINTS.SPRINT_BY_ID(id)),
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: sprintFeatureKeys.detail(id) });
      qc.invalidateQueries({ queryKey: sprintFeatureKeys.lists() });
      qc.invalidateQueries({ queryKey: sprintFeatureKeys.active() });
    },
  });
}

/** Activate sprint — POST /api/sprints/:id/activate
 *  Returns flat Sprint. 409 if another sprint is already active.
 */
export function useActivateSprint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<Sprint>(API_ENDPOINTS.SPRINT_ACTIVATE(id)),
    onSuccess: (data) => {
      qc.setQueryData(sprintFeatureKeys.detail(data.id), data);
      qc.invalidateQueries({ queryKey: sprintFeatureKeys.active() });
      qc.invalidateQueries({ queryKey: sprintFeatureKeys.lists() });
    },
  });
}

/** Complete sprint — POST /api/sprints/:id/complete
 *  Body: { summary?, unfinished?: "backlog" | "next_sprint" | "keep", next_sprint_id? }
 *  Returns the SprintReview plus moved_count. Auto-creates the review record.
 */
export function useCompleteSprint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      summary,
      unfinished = "keep",
      nextSprintId,
    }: {
      id: string;
      summary?: string;
      unfinished?: UnfinishedItemsAction;
      nextSprintId?: string | null;
    }) =>
      api.post<CompleteSprintResult>(API_ENDPOINTS.SPRINT_COMPLETE(id), {
        summary: summary || undefined,
        unfinished,
        next_sprint_id: unfinished === "next_sprint" ? nextSprintId : undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: sprintFeatureKeys.all });
      qc.invalidateQueries({ queryKey: ["backlog"] });
    },
  });
}

/** Upsert review — PUT /api/sprints/:id/review { summary? }
 *  Returns flat SprintReview.
 */
export function useUpsertSprintReview(sprintId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { summary?: string }) =>
      api.put<SprintReview>(API_ENDPOINTS.SPRINT_REVIEW(sprintId), payload),
    onSuccess: (data) => {
      qc.setQueryData(sprintFeatureKeys.review(sprintId), data);
    },
  });
}

/** Upsert retrospective — PUT /api/sprints/:id/retrospective { went_well?, went_wrong?, action_items? }
 *  Returns flat Retrospective.
 */
export function useUpsertRetrospective(sprintId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      went_well?: string;
      went_wrong?: string;
      action_items?: { id: string; text: string; done?: boolean }[];
    }) =>
      api.put<Retrospective>(
        API_ENDPOINTS.SPRINT_RETRO(sprintId),
        payload,
      ),
    onSuccess: (data) => {
      qc.setQueryData(sprintFeatureKeys.retro(sprintId), data);
    },
  });
}

/** Move work item into sprint — PATCH /api/work-items/:id/sprint { sprint_id, position? }
 *  Returns flat WorkItem. 409 if capacity exceeded.
 */
export function useMoveItemToSprint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      itemId,
      sprintId,
      position,
    }: {
      itemId: string;
      sprintId: string;
      position?: number;
    }) =>
      api.patch<WorkItem>(API_ENDPOINTS.WORK_ITEM_SPRINT(itemId), {
        sprint_id: sprintId,
        position,
      }),
    onSuccess: (_data, { sprintId }) => {
      qc.invalidateQueries({ queryKey: sprintFeatureKeys.workItems(sprintId) });
      qc.invalidateQueries({ queryKey: sprintFeatureKeys.detail(sprintId) });
      qc.invalidateQueries({ queryKey: sprintFeatureKeys.backlog() });
      // also invalidate the agile feature lists
      qc.invalidateQueries({ queryKey: ["work-items"] });
      qc.invalidateQueries({ queryKey: ["backlog"] });
    },
  });
}

/** Remove work item from sprint (move to backlog) — PATCH /api/work-items/:id/backlog
 *  Returns flat WorkItem.
 */
export function useMoveItemToBacklog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      itemId,
      sprintId,
    }: {
      itemId: string;
      sprintId: string;
    }) =>
      api.patch<WorkItem>(API_ENDPOINTS.WORK_ITEM_BACKLOG(itemId), {}),
    onSuccess: (_data, { sprintId }) => {
      qc.invalidateQueries({ queryKey: sprintFeatureKeys.workItems(sprintId) });
      qc.invalidateQueries({ queryKey: sprintFeatureKeys.detail(sprintId) });
      qc.invalidateQueries({ queryKey: sprintFeatureKeys.backlog() });
      qc.invalidateQueries({ queryKey: ["work-items"] });
      qc.invalidateQueries({ queryKey: ["backlog"] });
    },
  });
}
