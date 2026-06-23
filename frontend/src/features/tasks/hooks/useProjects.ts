"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS } from "@/types";
import type { Project } from "@/types";

export const projectKeys = {
  all: ["projects"] as const,
  lists: () => [...projectKeys.all, "list"] as const,
};

/** Lightweight project list used by the task form / filter dropdowns. Returns raw Project[]. */
export function useProjects() {
  return useQuery({
    queryKey: projectKeys.lists(),
    queryFn: () =>
      api.get<Project[]>(API_ENDPOINTS.PROJECTS),
    staleTime: 1000 * 60 * 5, // 5 min – project list rarely changes
  });
}

export interface ProjectPayload {
  name?: string;
  description?: string | null;
  color?: string | null;
  deadline?: string | null;
  organization_id?: string | null;
}

/** POST /api/projects */
export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ProjectPayload) =>
      api.post<Project>(API_ENDPOINTS.PROJECTS, payload),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: projectKeys.lists() }),
  });
}

/** PATCH /api/projects/:id */
export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ProjectPayload }) =>
      api.patch<Project>(API_ENDPOINTS.PROJECT_BY_ID(id), payload),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: projectKeys.lists() }),
  });
}

/** DELETE /api/projects/:id */
export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<void>(API_ENDPOINTS.PROJECT_BY_ID(id)),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: projectKeys.lists() }),
  });
}
