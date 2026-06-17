import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { CalendarEvent, EventListResponse } from "@/types";
import { toISODateString } from "@/lib/utils";

// ─── Query keys ───────────────────────────────────────────────────────────────

export const calendarKeys = {
  all: ["calendar"] as const,
  events: (start: string, end: string) =>
    ["calendar", "events", start, end] as const,
  event: (id: string) => ["calendar", "events", id] as const,
};

// ─── Request / Response shapes ────────────────────────────────────────────────

export interface CalendarEventsParams {
  start: Date;
  end: Date;
}

export interface CreateCalendarEventPayload {
  title: string;
  description?: string;
  start_time: string; // RFC 3339
  end_time: string;   // RFC 3339
  all_day?: boolean;
  location?: string;
  color?: string;
  recurrence_rule?: string;
}

export type UpdateCalendarEventPayload = Partial<CreateCalendarEventPayload>;

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useCalendarEvents({ start, end }: CalendarEventsParams) {
  const startStr = toISODateString(start);
  const endStr = toISODateString(end);

  return useQuery({
    queryKey: calendarKeys.events(startStr, endStr),
    queryFn: async () => {
      const res = await api.get<EventListResponse>("/api/calendar", {
        start: start.toISOString(),
        end: end.toISOString(),
      });
      return res.events;
    },
    staleTime: 1000 * 60 * 2,
  });
}

export function useCalendarEvent(id: string | null) {
  return useQuery({
    queryKey: calendarKeys.event(id ?? ""),
    queryFn: () => api.get<CalendarEvent>(`/api/calendar/${id}`),
    enabled: !!id,
  });
}

export function useCreateCalendarEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateCalendarEventPayload) =>
      api.post<CalendarEvent>("/api/calendar", payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: calendarKeys.all });
    },
  });
}

export function useUpdateCalendarEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: UpdateCalendarEventPayload & { id: string }) =>
      api.patch<CalendarEvent>(`/api/calendar/${id}`, payload),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: calendarKeys.all });
      qc.invalidateQueries({ queryKey: calendarKeys.event(id) });
    },
  });
}

export function useDeleteCalendarEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/calendar/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: calendarKeys.all });
    },
  });
}
