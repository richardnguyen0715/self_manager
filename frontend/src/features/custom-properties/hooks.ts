"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  createCustomProperty,
  deleteCustomProperty,
  listCustomProperties,
  listProjectPropertyValues,
  listWorkItemPropertyValues,
  setWorkItemPropertyValue,
  updateCustomProperty,
} from "./api";
import type {
  CreateCustomPropertyPayload,
  PropertyValue,
  UpdateCustomPropertyPayload,
  WorkItemPropertyValue,
} from "./types";

export const customPropertyKeys = {
  all: ["custom-properties"] as const,
  list: (projectId: string | null | undefined) =>
    [...customPropertyKeys.all, "list", projectId ?? "none"] as const,
  projectValues: (projectId: string | null | undefined) =>
    [...customPropertyKeys.all, "project-values", projectId ?? "none"] as const,
  workItemValues: (workItemId: string) =>
    [...customPropertyKeys.all, "work-item-values", workItemId] as const,
};

/** GET /api/custom-properties?project_id= */
export function useCustomProperties(projectId: string | null | undefined) {
  return useQuery({
    queryKey: customPropertyKeys.list(projectId),
    queryFn: () => listCustomProperties(projectId as string),
    enabled: !!projectId,
    staleTime: 60_000,
  });
}

/** GET /api/custom-properties/values?project_id= (every value in the project). */
export function useProjectPropertyValues(projectId: string | null | undefined) {
  return useQuery({
    queryKey: customPropertyKeys.projectValues(projectId),
    queryFn: () => listProjectPropertyValues(projectId as string),
    enabled: !!projectId,
    staleTime: 30_000,
  });
}

/** GET /api/custom-properties/work-items/:work_item_id */
export function useWorkItemPropertyValues(workItemId: string | null | undefined) {
  return useQuery({
    queryKey: customPropertyKeys.workItemValues(workItemId ?? "none"),
    queryFn: () => listWorkItemPropertyValues(workItemId as string),
    enabled: !!workItemId,
    staleTime: 30_000,
  });
}

/** POST /api/custom-properties */
export function useCreateCustomProperty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateCustomPropertyPayload) =>
      createCustomProperty(payload),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: customPropertyKeys.all }),
  });
}

/** PATCH /api/custom-properties/:id. Option removals can clear values, so refresh them too. */
export function useUpdateCustomProperty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...payload
    }: UpdateCustomPropertyPayload & { id: string }) =>
      updateCustomProperty(id, payload),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: customPropertyKeys.all }),
  });
}

/** DELETE /api/custom-properties/:id. Values cascade on the server. */
export function useDeleteCustomProperty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCustomProperty(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: customPropertyKeys.all }),
  });
}

/**
 * PUT /api/custom-properties/work-items/:work_item_id/:property_id.
 * Optimistic: the work item's value cache is updated before the request;
 * on failure it is rolled back. `null` clears the value.
 */
export function useSetPropertyValue(workItemId: string) {
  const queryClient = useQueryClient();
  const key = customPropertyKeys.workItemValues(workItemId);

  return useMutation({
    mutationFn: ({
      propertyId,
      value,
    }: {
      propertyId: string;
      value: PropertyValue;
    }) => setWorkItemPropertyValue(workItemId, propertyId, { value }),
    onMutate: async ({ propertyId, value }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<WorkItemPropertyValue[]>(key);
      queryClient.setQueryData<WorkItemPropertyValue[]>(key, (old = []) => {
        const rest = old.filter((v) => v.property_id !== propertyId);
        return value === null
          ? rest
          : [...rest, { property_id: propertyId, value }];
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: [...customPropertyKeys.all, "project-values"],
      }),
  });
}
