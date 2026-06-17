import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { TimeBlock, TimeBlockSummary, TimeBlockList } from "@/types";
import { toISODateString } from "@/lib/utils";

// ─── Query keys ───────────────────────────────────────────────────────────────

export const timeBlockKeys = {
  all: ["time-blocks"] as const,
  range: (start: string, end: string) =>
    ["time-blocks", "range", start, end] as const,
  item: (id: string) => ["time-blocks", id] as const,
};

// ─── Request / Response shapes ────────────────────────────────────────────────

export interface CreateTimeBlockPayload {
  title: string;
  start_time: string; // RFC 3339
  end_time: string;   // RFC 3339
  task_id?: string | null;
  color?: string | null;
}

export type UpdateTimeBlockPayload = Partial<CreateTimeBlockPayload>;

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useCalendarTimeBlocks({
  start,
  end,
}: {
  start: Date;
  end: Date;
}) {
  const startStr = toISODateString(start);
  const endStr = toISODateString(end);

  return useQuery({
    queryKey: timeBlockKeys.range(startStr, endStr),
    queryFn: async () => {
      const res = await api.get<{ data: TimeBlockList }>("/api/timeblocks", {
        from: start.toISOString(),
        to: end.toISOString(),
      });
      return res.data.items;
    },
    staleTime: 1000 * 60 * 2,
  });
}

export function useCreateTimeBlock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateTimeBlockPayload) => {
      const res = await api.post<{ data: TimeBlock }>("/api/timeblocks", payload);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: timeBlockKeys.all });
    },
  });
}

export function useUpdateTimeBlock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateTimeBlockPayload & { id: string }) => {
      const res = await api.patch<{ data: TimeBlock }>(`/api/timeblocks/${id}`, payload);
      return res.data;
    },
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: timeBlockKeys.all });
      qc.invalidateQueries({ queryKey: timeBlockKeys.item(id) });
    },
  });
}

export function useDeleteTimeBlock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/timeblocks/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: timeBlockKeys.all });
    },
  });
}
