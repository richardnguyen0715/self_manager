import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { TimeBlock, TimeBlockList } from "@/types";
import { API_ENDPOINTS } from "@/types";

// ─── Query keys ───────────────────────────────────────────────────────────────

export const timeBlockKeys = {
  all: ["time-blocks"] as const,
  lists: () => [...timeBlockKeys.all, "list"] as const,
  list: (params: TimeBlockListParams) =>
    [...timeBlockKeys.lists(), params] as const,
  detail: (id: string) => [...timeBlockKeys.all, "detail", id] as const,
};

// ─── API shapes ───────────────────────────────────────────────────────────────

export interface TimeBlockListParams {
  from?: string; // ISO8601
  to?: string; // ISO8601
  task_id?: string;
  offset?: number;
  limit?: number;
}

export interface CreateTimeBlockPayload {
  title: string;
  start_time: string; // ISO 8601
  end_time: string; // ISO 8601
  task_id?: string | null;
  color?: string | null;
}

export interface UpdateTimeBlockPayload {
  title?: string;
  start_time?: string;
  end_time?: string;
  task_id?: string | null;
  color?: string | null;
}

// ─── Response envelopes ───────────────────────────────────────────────────────

interface TimeBlockListEnvelope {
  data: TimeBlockList;
}

interface TimeBlockEnvelope {
  data: TimeBlock;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

/** Fetch a paginated list of time blocks, optionally filtered by date range. */
export function useTimeBlocks(params: TimeBlockListParams = {}) {
  return useQuery<TimeBlockListEnvelope>({
    queryKey: timeBlockKeys.list(params),
    queryFn: () =>
      api.get<TimeBlockListEnvelope>(API_ENDPOINTS.TIMEBLOCKS, {
        ...(params.from ? { from: params.from } : {}),
        ...(params.to ? { to: params.to } : {}),
        ...(params.task_id ? { task_id: params.task_id } : {}),
        ...(params.offset !== undefined ? { offset: params.offset } : {}),
        ...(params.limit !== undefined ? { limit: params.limit } : {}),
      }),
    staleTime: 1000 * 30, // 30 s — time blocks change frequently
  });
}

/** Fetch a single time block by id. */
export function useTimeBlock(id: string) {
  return useQuery<TimeBlockEnvelope>({
    queryKey: timeBlockKeys.detail(id),
    queryFn: () =>
      api.get<TimeBlockEnvelope>(API_ENDPOINTS.TIMEBLOCK_BY_ID(id)),
    enabled: Boolean(id),
  });
}

/** Create a new time block. */
export function useCreateTimeBlock() {
  const qc = useQueryClient();
  return useMutation<TimeBlockEnvelope, Error, CreateTimeBlockPayload>({
    mutationFn: (payload) =>
      api.post<TimeBlockEnvelope>(API_ENDPOINTS.TIMEBLOCKS, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: timeBlockKeys.lists() });
    },
  });
}

/** Update an existing time block (partial). */
export function useUpdateTimeBlock() {
  const qc = useQueryClient();
  return useMutation<
    TimeBlockEnvelope,
    Error,
    { id: string; payload: UpdateTimeBlockPayload }
  >({
    mutationFn: ({ id, payload }) =>
      api.patch<TimeBlockEnvelope>(
        API_ENDPOINTS.TIMEBLOCK_BY_ID(id),
        payload,
      ),
    onMutate: async ({ id, payload }) => {
      // Optimistic update on detail query
      await qc.cancelQueries({ queryKey: timeBlockKeys.detail(id) });
      const prev = qc.getQueryData<TimeBlockEnvelope>(
        timeBlockKeys.detail(id),
      );
      if (prev) {
        qc.setQueryData(timeBlockKeys.detail(id), {
          data: { ...prev.data, ...payload },
        });
      }
      return { prev };
    },
    onError: (_err, { id }, context) => {
      const ctx = context as { prev?: TimeBlockEnvelope } | undefined;
      if (ctx?.prev) {
        qc.setQueryData(timeBlockKeys.detail(id), ctx.prev);
      }
    },
    onSettled: (_data, _err, { id }) => {
      qc.invalidateQueries({ queryKey: timeBlockKeys.detail(id) });
      qc.invalidateQueries({ queryKey: timeBlockKeys.lists() });
    },
  });
}

/** Delete a time block. */
export function useDeleteTimeBlock() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) =>
      api.delete<void>(API_ENDPOINTS.TIMEBLOCK_BY_ID(id)),
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: timeBlockKeys.detail(id) });
      qc.invalidateQueries({ queryKey: timeBlockKeys.lists() });
    },
  });
}
