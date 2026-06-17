"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS } from "@/types";
import type {
  Goal,
  GoalListResponse,
  GoalProjectSummary,
  Project,
  TaskListItem,
  GoalStatus,
} from "@/types";

// ─── Query keys ───────────────────────────────────────────────────────────────

export const goalKeys = {
  all: ["goals"] as const,
  lists: () => [...goalKeys.all, "list"] as const,
  list: (filters: GoalListParams) => [...goalKeys.lists(), filters] as const,
  details: () => [...goalKeys.all, "detail"] as const,
  detail: (id: string) => [...goalKeys.details(), id] as const,
  projects: (goalId: string) => [...goalKeys.detail(goalId), "projects"] as const,
  projectTasks: (projectId: string) => ["projects", "detail", projectId, "tasks"] as const,
};

// ─── Parameter types ───────────────────────────────────────────────────────────

export interface GoalListParams {
  status?: GoalStatus | "all";
  limit?: number;
  offset?: number;
}

export interface CreateGoalPayload {
  title: string;
  description?: string | null;
  status?: GoalStatus;
  target_date?: string | null;
  color?: string | null;
  position?: number;
}

export interface UpdateGoalPayload {
  title?: string;
  description?: string | null;
  status?: GoalStatus;
  target_date?: string | null;
  color?: string | null;
  position?: number;
}

export interface CreateProjectPayload {
  name: string;
  description?: string | null;
  color?: string | null;
  status?: "active" | "completed" | "archived";
  deadline?: string | null;
  goal_id: string;
}

// ─── Goal CRUD hooks ───────────────────────────────────────────────────────────

export function useGoals(
  params: GoalListParams = {},
  options?: Partial<UseQueryOptions<GoalListResponse>>,
) {
  return useQuery<GoalListResponse>({
    queryKey: goalKeys.list(params),
    queryFn: () =>
      api.get<GoalListResponse>(API_ENDPOINTS.GOALS, {
        status: params.status !== "all" ? params.status : undefined,
        limit: params.limit ?? 100,
        offset: params.offset ?? 0,
      }),
    ...options,
  });
}

export function useGoal(
  id: string,
  options?: Partial<UseQueryOptions<Goal>>,
) {
  return useQuery<Goal>({
    queryKey: goalKeys.detail(id),
    queryFn: () => api.get<Goal>(API_ENDPOINTS.GOAL_BY_ID(id)),
    enabled: Boolean(id),
    ...options,
  });
}

export function useGoalProjects(
  goalId: string,
  options?: Partial<UseQueryOptions<GoalProjectSummary[]>>,
) {
  return useQuery<GoalProjectSummary[]>({
    queryKey: goalKeys.projects(goalId),
    queryFn: () =>
      api.get<GoalProjectSummary[]>(API_ENDPOINTS.GOAL_PROJECTS(goalId)),
    enabled: Boolean(goalId),
    ...options,
  });
}

export function useProjectTasks(
  projectId: string,
  enabled = true,
  options?: Partial<UseQueryOptions<TaskListItem[]>>,
) {
  return useQuery<TaskListItem[]>({
    queryKey: goalKeys.projectTasks(projectId),
    queryFn: () =>
      api.get<TaskListItem[]>(API_ENDPOINTS.TASKS, {
        project_id: projectId,
        limit: 100,
      }),
    enabled: Boolean(projectId) && enabled,
    ...options,
  });
}

// ─── Mutations ─────────────────────────────────────────────────────────────────

export function useCreateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateGoalPayload) =>
      api.post<Goal>(API_ENDPOINTS.GOALS, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: goalKeys.lists() });
    },
  });
}

export function useUpdateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: UpdateGoalPayload & { id: string }) =>
      api.patch<Goal>(API_ENDPOINTS.GOAL_BY_ID(id), payload),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: goalKeys.lists() });
      qc.invalidateQueries({ queryKey: goalKeys.detail(variables.id) });
    },
  });
}

export function useDeleteGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<void>(API_ENDPOINTS.GOAL_BY_ID(id)),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: goalKeys.lists() });
      qc.removeQueries({ queryKey: goalKeys.detail(id) });
    },
  });
}

export function useAbandonGoal() {
  const updateGoal = useUpdateGoal();
  return {
    ...updateGoal,
    mutate: (id: string) =>
      updateGoal.mutate({ id, status: "abandoned" }),
    mutateAsync: (id: string) =>
      updateGoal.mutateAsync({ id, status: "abandoned" }),
  };
}

export function useCompleteGoal() {
  const updateGoal = useUpdateGoal();
  return {
    ...updateGoal,
    mutate: (id: string) =>
      updateGoal.mutate({ id, status: "completed" }),
    mutateAsync: (id: string) =>
      updateGoal.mutateAsync({ id, status: "completed" }),
  };
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateProjectPayload) =>
      api.post<Project>(API_ENDPOINTS.PROJECTS, payload),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: goalKeys.projects(variables.goal_id) });
      qc.invalidateQueries({ queryKey: goalKeys.lists() });
    },
  });
}
