"use client";

import { useQuery } from "@tanstack/react-query";
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
