"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS } from "@/types";
import type { Initiative, Epic, AgileListResponse } from "@/types";
import type { CreateInitiativePayload, UpdateInitiativePayload } from "../types";

// ─── Query keys ───────────────────────────────────────────────────────────────

export const initiativeKeys = {
  all: ["initiatives"] as const,
  lists: () => [...initiativeKeys.all, "list"] as const,
  list: (filters?: { goal_id?: string; status?: string }) =>
    [...initiativeKeys.lists(), filters] as const,
  details: () => [...initiativeKeys.all, "detail"] as const,
  detail: (id: string) => [...initiativeKeys.details(), id] as const,
  epics: (id: string) => [...initiativeKeys.detail(id), "epics"] as const,
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useInitiatives(filters?: {
  goal_id?: string;
  status?: string;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: initiativeKeys.list(filters),
    queryFn: () =>
      api.get<AgileListResponse<Initiative>>(
        API_ENDPOINTS.INITIATIVES,
        filters as Record<string, string | number | boolean | undefined | null>,
      ),
    placeholderData: keepPreviousData,
  });
}

export function useInitiative(id: string) {
  return useQuery({
    queryKey: initiativeKeys.detail(id),
    queryFn: () => api.get<Initiative>(API_ENDPOINTS.INITIATIVE_BY_ID(id)),
    enabled: Boolean(id),
  });
}

export function useInitiativeEpics(initiativeId: string) {
  return useQuery({
    queryKey: initiativeKeys.epics(initiativeId),
    queryFn: () =>
      api.get<AgileListResponse<Epic>>(
        API_ENDPOINTS.INITIATIVE_EPICS(initiativeId),
      ),
    enabled: Boolean(initiativeId),
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function useCreateInitiative() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateInitiativePayload) =>
      api.post<Initiative>(API_ENDPOINTS.INITIATIVES, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: initiativeKeys.lists() });
    },
  });
}

export function useUpdateInitiative(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateInitiativePayload) =>
      api.patch<Initiative>(API_ENDPOINTS.INITIATIVE_BY_ID(id), payload),
    onSuccess: (data) => {
      qc.setQueryData(initiativeKeys.detail(id), data);
      qc.invalidateQueries({ queryKey: initiativeKeys.lists() });
    },
  });
}

export function useDeleteInitiative() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<void>(API_ENDPOINTS.INITIATIVE_BY_ID(id)),
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: initiativeKeys.detail(id) });
      qc.invalidateQueries({ queryKey: initiativeKeys.lists() });
    },
  });
}
