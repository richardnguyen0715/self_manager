"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS } from "@/types";
import type { Organization } from "@/types";

export const organizationKeys = {
  all: ["organizations"] as const,
  lists: () => [...organizationKeys.all, "list"] as const,
};

/** GET /api/organizations — user's orgs, ordered by position. Returns raw Organization[]. */
export function useOrganizations() {
  return useQuery({
    queryKey: organizationKeys.lists(),
    queryFn: () => api.get<Organization[]>(API_ENDPOINTS.ORGANIZATIONS),
    staleTime: 1000 * 60 * 5, // 5 min – org list rarely changes
  });
}

export interface OrganizationPayload {
  name?: string;
  description?: string | null;
  color?: string | null;
  position?: number;
}

/** POST /api/organizations */
export function useCreateOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: OrganizationPayload) =>
      api.post<Organization>(API_ENDPOINTS.ORGANIZATIONS, payload),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: organizationKeys.lists() }),
  });
}

/** PATCH /api/organizations/:id */
export function useUpdateOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: OrganizationPayload }) =>
      api.patch<Organization>(API_ENDPOINTS.ORGANIZATION_BY_ID(id), payload),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: organizationKeys.lists() }),
  });
}

/** DELETE /api/organizations/:id — hard delete (orgs are not in trash scope). */
export function useDeleteOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<void>(API_ENDPOINTS.ORGANIZATION_BY_ID(id)),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: organizationKeys.lists() }),
  });
}
