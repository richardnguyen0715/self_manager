import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS } from "@/types";
import type { CalendarType } from "@/types";

// ─── Query keys ───────────────────────────────────────────────────────────────

export const calendarTypeKeys = {
  all: ["calendar-types"] as const,
  list: () => ["calendar-types", "list"] as const,
};

// ─── Payloads ─────────────────────────────────────────────────────────────────

export interface CreateCalendarTypePayload {
  name: string;
  color: string;
  icon?: string | null;
  description?: string | null;
  default_all_day?: boolean;
  default_reminder_minutes?: number | null;
}

export type UpdateCalendarTypePayload = Partial<CreateCalendarTypePayload>;

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useCalendarTypes() {
  return useQuery({
    queryKey: calendarTypeKeys.list(),
    queryFn: () => api.get<CalendarType[]>(API_ENDPOINTS.CALENDAR_TYPES),
    staleTime: 1000 * 60 * 5,
  });
}

export function useCreateCalendarType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateCalendarTypePayload) =>
      api.post<CalendarType>(API_ENDPOINTS.CALENDAR_TYPES, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: calendarTypeKeys.all }),
  });
}

export function useUpdateCalendarType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: UpdateCalendarTypePayload & { id: string }) =>
      api.patch<CalendarType>(API_ENDPOINTS.CALENDAR_TYPE_BY_ID(id), payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: calendarTypeKeys.all }),
  });
}

export function useDeleteCalendarType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(API_ENDPOINTS.CALENDAR_TYPE_BY_ID(id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: calendarTypeKeys.all });
      // Events reference types for colour; refresh them too.
      qc.invalidateQueries({ queryKey: ["calendar"] });
    },
  });
}
