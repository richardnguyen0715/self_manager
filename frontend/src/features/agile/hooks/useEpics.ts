"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS } from "@/types";
import type { Epic, WorkItemListItem, AgileListResponse } from "@/types";
import type { CreateEpicPayload, UpdateEpicPayload } from "../types";

// ─── Query keys ───────────────────────────────────────────────────────────────

export const epicKeys = {
  all: ["epics"] as const,
  lists: () => [...epicKeys.all, "list"] as const,
  list: (filters?: { initiative_id?: string; status?: string }) =>
    [...epicKeys.lists(), filters] as const,
  details: () => [...epicKeys.all, "detail"] as const,
  detail: (id: string) => [...epicKeys.details(), id] as const,
  workItems: (id: string) => [...epicKeys.detail(id), "work-items"] as const,
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useEpics(filters?: {
  initiative_id?: string;
  status?: string;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: epicKeys.list(filters),
    queryFn: () =>
      api.get<AgileListResponse<Epic>>(
        API_ENDPOINTS.EPICS,
        filters as Record<string, string | number | boolean | undefined | null>,
      ),
    placeholderData: keepPreviousData,
  });
}

export function useEpic(id: string) {
  return useQuery({
    queryKey: epicKeys.detail(id),
    queryFn: () => api.get<Epic>(API_ENDPOINTS.EPIC_BY_ID(id)),
    enabled: Boolean(id),
  });
}

export function useEpicWorkItems(epicId: string, filters?: { status?: string }) {
  return useQuery({
    queryKey: epicKeys.workItems(epicId),
    queryFn: () =>
      api.get<AgileListResponse<WorkItemListItem>>(
        API_ENDPOINTS.EPIC_WORK_ITEMS(epicId),
        filters as Record<string, string | number | boolean | undefined | null>,
      ),
    enabled: Boolean(epicId),
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function useCreateEpic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateEpicPayload) =>
      api.post<Epic>(API_ENDPOINTS.EPICS, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: epicKeys.lists() });
    },
  });
}

export function useUpdateEpic(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateEpicPayload) =>
      api.patch<Epic>(API_ENDPOINTS.EPIC_BY_ID(id), payload),
    onSuccess: (data) => {
      qc.setQueryData(epicKeys.detail(id), data);
      qc.invalidateQueries({ queryKey: epicKeys.lists() });
    },
  });
}

export function useDeleteEpic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(API_ENDPOINTS.EPIC_BY_ID(id)),
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: epicKeys.detail(id) });
      qc.invalidateQueries({ queryKey: epicKeys.lists() });
    },
  });
}
