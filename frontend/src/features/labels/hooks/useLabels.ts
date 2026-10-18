"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { api } from "@/lib/api";
import { workItemKeys } from "@/features/workitems/hooks/useWorkItems";
import type {
  Label,
  CreateLabelPayload,
  UpdateLabelPayload,
} from "../types";

const LABELS_PATH = "/api/labels";

export const labelKeys = {
  all: ["labels"] as const,
  list: (projectId: string | null | undefined) =>
    [...labelKeys.all, "list", projectId ?? "all"] as const,
};

/**
 * GET /api/labels?project_id=
 * With a projectId: that project's labels plus the user's global labels.
 * Without: every label the user owns.
 */
export function useLabels(projectId?: string | null) {
  return useQuery({
    queryKey: labelKeys.list(projectId),
    queryFn: () =>
      api.get<Label[]>(LABELS_PATH, { project_id: projectId ?? undefined }),
    staleTime: 60_000,
  });
}

/** POST /api/labels */
export function useCreateLabel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateLabelPayload) =>
      api.post<Label>(LABELS_PATH, payload),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: labelKeys.all }),
  });
}

/** PATCH /api/labels/:id. A rename also rewrites work items, so refresh those. */
export function useUpdateLabel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: UpdateLabelPayload & { id: string }) =>
      api.patch<Label>(`${LABELS_PATH}/${id}`, payload),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: labelKeys.all }),
        queryClient.invalidateQueries({ queryKey: workItemKeys.all }),
      ]),
  });
}

/** DELETE /api/labels/:id. Also removes the name from work items. */
export function useDeleteLabel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`${LABELS_PATH}/${id}`),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: labelKeys.all }),
        queryClient.invalidateQueries({ queryKey: workItemKeys.all }),
      ]),
  });
}
