import { api } from "@/lib/api";
import type {
  CustomProperty,
  CreateCustomPropertyPayload,
  UpdateCustomPropertyPayload,
  ProjectPropertyValue,
  SetPropertyValuePayload,
  WorkItemPropertyValue,
} from "./types";

// ─── Custom property API endpoints (contract: design/estimate-custom-props.md B) ─

const BASE = "/api/custom-properties";

export const CUSTOM_PROPERTY_ENDPOINTS = {
  LIST: BASE,
  VALUES: `${BASE}/values`,
  BY_ID: (id: string) => `${BASE}/${id}`,
  WORK_ITEM_VALUES: (workItemId: string) => `${BASE}/work-items/${workItemId}`,
  WORK_ITEM_VALUE: (workItemId: string, propertyId: string) =>
    `${BASE}/work-items/${workItemId}/${propertyId}`,
} as const;

/** GET /api/custom-properties?project_id= */
export function listCustomProperties(projectId: string) {
  return api.get<CustomProperty[]>(CUSTOM_PROPERTY_ENDPOINTS.LIST, {
    project_id: projectId,
  });
}

/** POST /api/custom-properties */
export function createCustomProperty(payload: CreateCustomPropertyPayload) {
  return api.post<CustomProperty>(CUSTOM_PROPERTY_ENDPOINTS.LIST, payload);
}

/** PATCH /api/custom-properties/:id */
export function updateCustomProperty(
  id: string,
  payload: UpdateCustomPropertyPayload,
) {
  return api.patch<CustomProperty>(
    CUSTOM_PROPERTY_ENDPOINTS.BY_ID(id),
    payload,
  );
}

/** DELETE /api/custom-properties/:id */
export function deleteCustomProperty(id: string) {
  return api.delete<void>(CUSTOM_PROPERTY_ENDPOINTS.BY_ID(id));
}

/** GET /api/custom-properties/values?project_id= (all values for list display) */
export function listProjectPropertyValues(projectId: string) {
  return api.get<ProjectPropertyValue[]>(CUSTOM_PROPERTY_ENDPOINTS.VALUES, {
    project_id: projectId,
  });
}

/** GET /api/custom-properties/work-items/:work_item_id */
export function listWorkItemPropertyValues(workItemId: string) {
  return api.get<WorkItemPropertyValue[]>(
    CUSTOM_PROPERTY_ENDPOINTS.WORK_ITEM_VALUES(workItemId),
  );
}

/** PUT /api/custom-properties/work-items/:work_item_id/:property_id. null clears. */
export function setWorkItemPropertyValue(
  workItemId: string,
  propertyId: string,
  payload: SetPropertyValuePayload,
) {
  return api.put<WorkItemPropertyValue>(
    CUSTOM_PROPERTY_ENDPOINTS.WORK_ITEM_VALUE(workItemId, propertyId),
    payload,
  );
}
