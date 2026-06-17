"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS } from "@/types";
import type { Habit, HabitLog } from "@/types";
import { toISODateString } from "@/lib/utils";

// ─── Query Key Factory ─────────────────────────────────────────────────────────

export const habitKeys = {
  all: ["habits"] as const,
  lists: () => [...habitKeys.all, "list"] as const,
  list: (filters: HabitListFilters) =>
    [...habitKeys.lists(), filters] as const,
  detail: (id: string) => [...habitKeys.all, "detail", id] as const,
  logs: (habitId: string) => [...habitKeys.all, "logs", habitId] as const,
  logRange: (habitId: string, from: string, to: string) =>
    [...habitKeys.logs(habitId), from, to] as const,
} as const;

// ─── Request / Response types ──────────────────────────────────────────────────

// Backend GET /api/habits accepts no query params — list is always all habits
// for the authenticated user. Client-side filtering is done in components.
export interface HabitListFilters {
  // kept for query key differentiation; no params are sent to the server
  _unused?: never;
}

export interface CreateHabitPayload {
  name: string;
  habit_type: Habit["habit_type"];
  frequency: Habit["frequency"];
  description?: string | null;
  target_value?: number | null;
  frequency_days?: number[] | null;
  reminder_time?: string | null;
  color?: string | null;
  icon?: string | null;
  position?: number | null;
}

export type UpdateHabitPayload = Partial<
  Omit<CreateHabitPayload, "name"> & { name?: string }
> & {
  archived?: boolean;
};

export interface LogHabitPayload {
  log_date: string; // YYYY-MM-DD
  value: number;
  note?: string | null;
}

// ─── Hooks ─────────────────────────────────────────────────────────────────────

export function useHabits(
  filters: HabitListFilters = {},
  options?: Omit<
    UseQueryOptions<Habit[], Error>,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery<Habit[], Error>({
    queryKey: habitKeys.list(filters),
    queryFn: async () => {
      // GET /api/habits — returns HabitResponse[] (raw array, no envelope)
      const res = await api.get<Habit[]>(API_ENDPOINTS.HABITS);
      return res;
    },
    ...options,
  });
}

export function useHabit(id: string) {
  return useQuery<Habit, Error>({
    queryKey: habitKeys.detail(id),
    queryFn: async () => {
      // GET /api/habits/:id — returns flat HabitResponse
      const res = await api.get<Habit>(API_ENDPOINTS.HABIT_BY_ID(id));
      return res;
    },
    enabled: Boolean(id),
  });
}

export function useHabitLogs(
  habitId: string,
  from: string,
  to: string,
  enabled = true,
) {
  return useQuery<HabitLog[], Error>({
    queryKey: habitKeys.logRange(habitId, from, to),
    queryFn: async () => {
      // GET /api/habits/:id/logs?from=YYYY-MM-DD&to=YYYY-MM-DD
      // returns HabitLogResponse[] (raw array, no envelope)
      const res = await api.get<HabitLog[]>(
        API_ENDPOINTS.HABIT_LOGS(habitId),
        { from, to },
      );
      return res;
    },
    enabled: enabled && Boolean(habitId),
  });
}

export function useCreateHabit() {
  const queryClient = useQueryClient();

  return useMutation<Habit, Error, CreateHabitPayload>({
    mutationFn: async (payload) => {
      // POST /api/habits — returns 201 + flat HabitResponse
      const res = await api.post<Habit>(API_ENDPOINTS.HABITS, payload);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: habitKeys.lists() });
    },
  });
}

export function useUpdateHabit(id: string) {
  const queryClient = useQueryClient();

  return useMutation<Habit, Error, UpdateHabitPayload>({
    mutationFn: async (payload) => {
      // PATCH /api/habits/:id — returns flat HabitResponse
      const res = await api.patch<Habit>(
        API_ENDPOINTS.HABIT_BY_ID(id),
        payload,
      );
      return res;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<Habit>(habitKeys.detail(id), updated);
      queryClient.invalidateQueries({ queryKey: habitKeys.lists() });
    },
  });
}

export function useArchiveHabit(id: string) {
  const queryClient = useQueryClient();

  return useMutation<Habit, Error, void>({
    mutationFn: async () => {
      // POST /api/habits/:id/archive — returns flat HabitResponse
      const res = await api.post<Habit>(API_ENDPOINTS.HABIT_ARCHIVE(id));
      return res;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<Habit>(habitKeys.detail(id), updated);
      queryClient.invalidateQueries({ queryKey: habitKeys.lists() });
    },
  });
}

export function useDeleteHabit() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      // DELETE /api/habits/:id — 204 No Content
      await api.delete(API_ENDPOINTS.HABIT_BY_ID(id));
    },
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: habitKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: habitKeys.lists() });
    },
  });
}

export function useLogHabit(habitId: string) {
  const queryClient = useQueryClient();

  return useMutation<HabitLog, Error, LogHabitPayload>({
    mutationFn: async (payload) => {
      // POST /api/habits/:id/logs — returns 201 + flat HabitLogResponse
      const res = await api.post<HabitLog>(
        API_ENDPOINTS.HABIT_LOGS(habitId),
        payload,
      );
      return res;
    },
    onSuccess: () => {
      // Refetch habit to pick up updated streak / completion_rate_30d
      queryClient.invalidateQueries({ queryKey: habitKeys.detail(habitId) });
      queryClient.invalidateQueries({ queryKey: habitKeys.lists() });
      // Invalidate any range log queries for this habit
      queryClient.invalidateQueries({ queryKey: habitKeys.logs(habitId) });
    },
  });
}

export function useDeleteHabitLog(habitId: string) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (logId) => {
      // DELETE /api/habits/:id/logs/:log_id — 204 No Content
      await api.delete(API_ENDPOINTS.HABIT_LOG_BY_ID(habitId, logId));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: habitKeys.detail(habitId) });
      queryClient.invalidateQueries({ queryKey: habitKeys.lists() });
      queryClient.invalidateQueries({ queryKey: habitKeys.logs(habitId) });
    },
  });
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Returns today's date as a YYYY-MM-DD string. */
export function todayISODate(): string {
  return toISODateString(new Date());
}
