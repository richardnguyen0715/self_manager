"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  SavedView,
  SavedViewScope,
  CreateSavedViewPayload,
  UpdateSavedViewPayload,
} from "../types";

const SAVED_VIEWS_PATH = "/api/saved-views";

export const savedViewKeys = {
  all: ["saved-views"] as const,
  list: (scope: SavedViewScope, projectId: string | null) =>
    [...savedViewKeys.all, scope, projectId ?? "all-projects"] as const,
};

/** GET /api/saved-views?scope=&project_id= */
export function useSavedViews(
  scope: SavedViewScope,
  projectId: string | null,
) {
  return useQuery({
    queryKey: savedViewKeys.list(scope, projectId),
    queryFn: () =>
      api.get<SavedView[]>(SAVED_VIEWS_PATH, {
        scope,
        project_id: projectId,
      }),
  });
}

/** POST /api/saved-views */
export function useCreateSavedView() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSavedViewPayload) =>
      api.post<SavedView>(SAVED_VIEWS_PATH, payload),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: savedViewKeys.all }),
  });
}

/** PATCH /api/saved-views/:id */
export function useUpdateSavedView() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...payload
    }: UpdateSavedViewPayload & { id: string }) =>
      api.patch<SavedView>(`${SAVED_VIEWS_PATH}/${id}`, payload),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: savedViewKeys.all }),
  });
}

/** DELETE /api/saved-views/:id */
export function useDeleteSavedView() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`${SAVED_VIEWS_PATH}/${id}`),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: savedViewKeys.all }),
  });
}
