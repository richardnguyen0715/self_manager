"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS } from "@/types";
import type { Tag } from "@/types";

export const tagKeys = {
  all: ["tags"] as const,
  lists: () => [...tagKeys.all, "list"] as const,
};

/** All user tags – used in filters and the task form. Returns raw Tag[]. */
export function useTags() {
  return useQuery({
    queryKey: tagKeys.lists(),
    queryFn: () =>
      api.get<Tag[]>(API_ENDPOINTS.TAGS),
    staleTime: 1000 * 60 * 5,
  });
}

/** Add a tag to a task (POST /api/tasks/:id/tags). Returns 204. */
export function useAddTagToTask(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tagId: string) =>
      api.post<void>(API_ENDPOINTS.TASK_ATTACH_TAG(taskId), { tag_id: tagId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks", "detail", taskId] });
      qc.invalidateQueries({ queryKey: ["tasks", "list"] });
    },
  });
}

/** Remove a tag from a task (DELETE /api/tasks/:id/tags/:tag_id). Returns 204. */
export function useRemoveTagFromTask(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tagId: string) =>
      api.delete<void>(API_ENDPOINTS.TASK_DETACH_TAG(taskId, tagId)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks", "detail", taskId] });
      qc.invalidateQueries({ queryKey: ["tasks", "list"] });
    },
  });
}
