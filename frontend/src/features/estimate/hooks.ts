"use client";

import { useQuery } from "@tanstack/react-query";
import { useProjects } from "@/features/tasks/hooks/useProjects";
import { fetchEstimateSystems } from "./api";
import { DEFAULT_ESTIMATE_SYSTEM_ID, type EstimateSystem } from "./types";

export const estimateKeys = {
  all: ["estimate-systems"] as const,
};

/** The estimate-system catalog. It is static on the server, so cache it for the session. */
export function useEstimateSystems() {
  return useQuery({
    queryKey: estimateKeys.all,
    queryFn: fetchEstimateSystems,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

/** Resolve a system id to its catalog entry (undefined while loading or if unknown). */
export function useEstimateSystem(
  systemId: string | null | undefined,
): EstimateSystem | undefined {
  const { data } = useEstimateSystems();
  const id = systemId ?? DEFAULT_ESTIMATE_SYSTEM_ID;
  return data?.find((s) => s.id === id);
}

/**
 * The estimate system id of a project, read from the projects query cache.
 * Falls back to fibonacci when the project is unknown or has no project.
 */
export function useEstimateSystemIdForProject(
  projectId: string | null | undefined,
): string {
  const { data: projects } = useProjects();
  if (!projectId) return DEFAULT_ESTIMATE_SYSTEM_ID;
  return (
    projects?.find((p) => p.id === projectId)?.estimate_system ??
    DEFAULT_ESTIMATE_SYSTEM_ID
  );
}

/** The catalog entry for a project's estimate system. */
export function useEstimateSystemForProject(
  projectId: string | null | undefined,
): EstimateSystem | undefined {
  const systemId = useEstimateSystemIdForProject(projectId);
  return useEstimateSystem(systemId);
}
