"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { api, getAccessToken } from "@/lib/api";
import { API_ENDPOINTS } from "@/types";
import type {
  WorkItem,
  WorkItemListItem,
  WorkItemSubtask,
  WorkItemComment,
  AgileListResponse,
  Epic,
  Sprint,
} from "@/types";
import type {
  CreateWorkItemPayload,
  UpdateWorkItemPayload,
  SetWorkItemStatusPayload,
  SetWorkItemPointsPayload,
  CreateWorkItemSubtaskPayload,
  UpdateWorkItemSubtaskPayload,
  WorkItemFiltersState,
  WorkItemLink,
  AddWorkItemLinkPayload,
  WorkItemWebLink,
  AddWebLinkPayload,
  WorkItemAttachment,
} from "../types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

// ─── Query keys ───────────────────────────────────────────────────────────────

export const workItemKeys = {
  all: ["work-items"] as const,
  lists: () => [...workItemKeys.all, "list"] as const,
  list: (filters: WorkItemFiltersState) =>
    [...workItemKeys.lists(), filters] as const,
  details: () => [...workItemKeys.all, "detail"] as const,
  detail: (id: string) => [...workItemKeys.details(), id] as const,
  subtasks: (id: string) => [...workItemKeys.detail(id), "subtasks"] as const,
  links: (id: string) => [...workItemKeys.detail(id), "links"] as const,
  webLinks: (id: string) => [...workItemKeys.detail(id), "web-links"] as const,
  attachments: (id: string) =>
    [...workItemKeys.detail(id), "attachments"] as const,
  comments: (id: string) => [...workItemKeys.detail(id), "comments"] as const,
};

function filtersToParams(
  filters: WorkItemFiltersState,
): Record<string, string | number | boolean | undefined | null> {
  const p: Record<string, string | number | boolean | undefined | null> = {};
  if (filters.sprint_id) p.sprint_id = filters.sprint_id;
  if (filters.epic_id) p.epic_id = filters.epic_id;
  if (filters.project_id) p.project_id = filters.project_id;
  if (filters.status && filters.status !== "all") p.status = filters.status;
  if (filters.type && filters.type !== "all") p.type = filters.type;
  if (filters.priority && filters.priority !== "all")
    p.priority = filters.priority;
  if (filters.search) p.search = filters.search;
  if (filters.limit != null) p.limit = filters.limit;
  if (filters.offset != null) p.offset = filters.offset;
  return p;
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/** GET /api/work-items — returns { data: WorkItemListItem[], total } */
export function useWorkItems(filters: WorkItemFiltersState = {}) {
  return useQuery({
    queryKey: workItemKeys.list(filters),
    queryFn: () =>
      api.get<AgileListResponse<WorkItemListItem>>(
        API_ENDPOINTS.WORK_ITEMS,
        filtersToParams(filters),
      ),
    placeholderData: keepPreviousData,
  });
}

/** GET /api/work-items/:id — flat WorkItem (with embedded subtasks) */
export function useWorkItem(id: string) {
  return useQuery({
    queryKey: workItemKeys.detail(id),
    queryFn: () => api.get<WorkItem>(API_ENDPOINTS.WORK_ITEM_BY_ID(id)),
    enabled: Boolean(id),
  });
}

/** GET /api/work-items/:id/subtasks — WorkItemSubtask[] */
export function useWorkItemSubtasks(workItemId: string) {
  return useQuery({
    queryKey: workItemKeys.subtasks(workItemId),
    queryFn: () =>
      api.get<WorkItemSubtask[]>(
        API_ENDPOINTS.WORK_ITEM_SUBTASKS(workItemId),
      ),
    enabled: Boolean(workItemId),
  });
}

/** GET /api/epics/:id — used for breadcrumb / parent display */
export function useEpicById(epicId: string) {
  return useQuery({
    queryKey: ["epics", "detail", epicId],
    queryFn: () => api.get<Epic>(API_ENDPOINTS.EPIC_BY_ID(epicId)),
    enabled: Boolean(epicId),
  });
}

/** GET /api/sprints/:id — used for sprint name in Details rail */
export function useSprintById(sprintId: string) {
  return useQuery({
    queryKey: ["sprints", "detail", sprintId],
    queryFn: () => api.get<Sprint>(API_ENDPOINTS.SPRINT_BY_ID(sprintId)),
    enabled: Boolean(sprintId),
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

/** POST /api/work-items — create; body: CreateWorkItemPayload */
export function useCreateWorkItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateWorkItemPayload) =>
      api.post<WorkItem>(API_ENDPOINTS.WORK_ITEMS, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: workItemKeys.lists() });
    },
  });
}

/** PATCH /api/work-items/:id — partial update */
export function useUpdateWorkItem(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateWorkItemPayload) =>
      api.patch<WorkItem>(API_ENDPOINTS.WORK_ITEM_BY_ID(id), payload),
    onSuccess: (data) => {
      qc.setQueryData(workItemKeys.detail(id), data);
      qc.invalidateQueries({ queryKey: workItemKeys.lists() });
    },
  });
}

/** DELETE /api/work-items/:id — 204 */
export function useDeleteWorkItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<void>(API_ENDPOINTS.WORK_ITEM_BY_ID(id)),
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: workItemKeys.detail(id) });
      qc.invalidateQueries({ queryKey: workItemKeys.lists() });
    },
  });
}

/** PATCH /api/work-items/:id/status — { status } */
export function useSetWorkItemStatus(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SetWorkItemStatusPayload) =>
      api.patch<WorkItem>(API_ENDPOINTS.WORK_ITEM_STATUS(id), payload),
    onSuccess: (data) => {
      qc.setQueryData(workItemKeys.detail(id), data);
      qc.invalidateQueries({ queryKey: workItemKeys.lists() });
      // also invalidate sprint queries in case sprint board is visible
      qc.invalidateQueries({ queryKey: ["sprints"] });
    },
  });
}

/** PATCH /api/work-items/:id/points — { story_points: 1|3|5|8|null } */
export function useSetWorkItemPoints(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SetWorkItemPointsPayload) =>
      api.patch<WorkItem>(API_ENDPOINTS.WORK_ITEM_POINTS(id), payload),
    onSuccess: (data) => {
      qc.setQueryData(workItemKeys.detail(id), data);
      qc.invalidateQueries({ queryKey: workItemKeys.lists() });
    },
  });
}

// ─── Subtask mutations ─────────────────────────────────────────────────────────

/** POST /api/work-items/:id/subtasks — { title } */
export function useCreateWorkItemSubtask(workItemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateWorkItemSubtaskPayload) =>
      api.post<WorkItemSubtask>(
        API_ENDPOINTS.WORK_ITEM_SUBTASKS(workItemId),
        payload,
      ),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: workItemKeys.subtasks(workItemId),
      });
      qc.invalidateQueries({ queryKey: workItemKeys.detail(workItemId) });
    },
  });
}

/** PATCH /api/work-items/:id/subtasks/:subtask_id — { title?, is_done?, position? } */
export function useUpdateWorkItemSubtask(
  workItemId: string,
  subtaskId: string,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateWorkItemSubtaskPayload) =>
      api.patch<WorkItemSubtask>(
        API_ENDPOINTS.WORK_ITEM_SUBTASK_BY_ID(workItemId, subtaskId),
        payload,
      ),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: workItemKeys.subtasks(workItemId),
      });
      qc.invalidateQueries({ queryKey: workItemKeys.detail(workItemId) });
    },
  });
}

/** DELETE /api/work-items/:id/subtasks/:subtask_id — 204 */
export function useDeleteWorkItemSubtask(workItemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (subtaskId: string) =>
      api.delete<void>(
        API_ENDPOINTS.WORK_ITEM_SUBTASK_BY_ID(workItemId, subtaskId),
      ),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: workItemKeys.subtasks(workItemId),
      });
      qc.invalidateQueries({ queryKey: workItemKeys.detail(workItemId) });
    },
  });
}

// ─── Linked work items ────────────────────────────────────────────────────────

/** GET /api/work-items/:id/links — WorkItemLink[] */
export function useWorkItemLinks(workItemId: string) {
  return useQuery({
    queryKey: workItemKeys.links(workItemId),
    queryFn: () =>
      api.get<WorkItemLink[]>(API_ENDPOINTS.WORK_ITEM_LINKS(workItemId)),
    enabled: Boolean(workItemId),
  });
}

/** POST /api/work-items/:id/links — { target_work_item_id, link_type? } */
export function useAddWorkItemLink(workItemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: AddWorkItemLinkPayload) =>
      api.post<WorkItemLink>(
        API_ENDPOINTS.WORK_ITEM_LINKS(workItemId),
        payload,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: workItemKeys.links(workItemId) });
      qc.invalidateQueries({ queryKey: workItemKeys.detail(workItemId) });
    },
  });
}

/** DELETE /api/work-items/:id/links/:link_id — 204 */
export function useDeleteWorkItemLink(workItemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (linkId: string) =>
      api.delete<void>(
        API_ENDPOINTS.WORK_ITEM_LINK_BY_ID(workItemId, linkId),
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: workItemKeys.links(workItemId) });
      qc.invalidateQueries({ queryKey: workItemKeys.detail(workItemId) });
    },
  });
}

// ─── Web links ────────────────────────────────────────────────────────────────

/** GET /api/work-items/:id/web-links — WebLink[] */
export function useWebLinks(workItemId: string) {
  return useQuery({
    queryKey: workItemKeys.webLinks(workItemId),
    queryFn: () =>
      api.get<WorkItemWebLink[]>(
        API_ENDPOINTS.WORK_ITEM_WEB_LINKS(workItemId),
      ),
    enabled: Boolean(workItemId),
  });
}

/** POST /api/work-items/:id/web-links — { url, title? } */
export function useAddWebLink(workItemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: AddWebLinkPayload) =>
      api.post<WorkItemWebLink>(
        API_ENDPOINTS.WORK_ITEM_WEB_LINKS(workItemId),
        payload,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: workItemKeys.webLinks(workItemId) });
      qc.invalidateQueries({ queryKey: workItemKeys.detail(workItemId) });
    },
  });
}

/** DELETE /api/work-items/:id/web-links/:link_id — 204 */
export function useDeleteWebLink(workItemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (linkId: string) =>
      api.delete<void>(
        API_ENDPOINTS.WORK_ITEM_WEB_LINK_BY_ID(workItemId, linkId),
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: workItemKeys.webLinks(workItemId) });
      qc.invalidateQueries({ queryKey: workItemKeys.detail(workItemId) });
    },
  });
}

// ─── Attachments ──────────────────────────────────────────────────────────────

/** GET /api/work-items/:id/attachments — Attachment[] */
export function useAttachments(workItemId: string) {
  return useQuery({
    queryKey: workItemKeys.attachments(workItemId),
    queryFn: () =>
      api.get<WorkItemAttachment[]>(
        API_ENDPOINTS.WORK_ITEM_ATTACHMENTS(workItemId),
      ),
    enabled: Boolean(workItemId),
  });
}

/**
 * POST /api/work-items/:id/attachments — multipart/form-data.
 * Uses raw fetch so the browser sets the correct multipart boundary.
 * Do NOT set Content-Type manually for FormData.
 */
export function useUploadAttachment(workItemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (formData: FormData) => {
      const token = getAccessToken();
      const url = `${API_BASE_URL}${API_ENDPOINTS.WORK_ITEM_ATTACHMENTS(workItemId)}`;
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const response = await fetch(url, {
        method: "POST",
        headers,
        body: formData,
      });

      if (!response.ok) {
        let msg = `Upload failed with status ${response.status}`;
        try {
          const body = await response.json();
          if (body?.message) msg = body.message;
        } catch {
          // ignore
        }
        throw new Error(msg);
      }

      return response.json() as Promise<WorkItemAttachment>;
    },
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: workItemKeys.attachments(workItemId),
      });
      qc.invalidateQueries({ queryKey: workItemKeys.detail(workItemId) });
    },
  });
}

/** DELETE /api/work-items/:id/attachments/:att_id — 204 */
export function useDeleteAttachment(workItemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (attId: string) =>
      api.delete<void>(
        API_ENDPOINTS.WORK_ITEM_ATTACHMENT_BY_ID(workItemId, attId),
      ),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: workItemKeys.attachments(workItemId),
      });
      qc.invalidateQueries({ queryKey: workItemKeys.detail(workItemId) });
    },
  });
}

// ─── Work item comments ───────────────────────────────────────────────────────

/** GET /api/work-items/:id/comments — WorkItemComment[] (oldest first) */
export function useWorkItemComments(workItemId: string) {
  return useQuery({
    queryKey: workItemKeys.comments(workItemId),
    queryFn: () =>
      api.get<WorkItemComment[]>(API_ENDPOINTS.WORK_ITEM_COMMENTS(workItemId)),
    enabled: Boolean(workItemId),
  });
}

/** POST /api/work-items/:id/comments — { body } → WorkItemComment */
export function useCreateWorkItemComment(workItemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { body: string }) =>
      api.post<WorkItemComment>(
        API_ENDPOINTS.WORK_ITEM_COMMENTS(workItemId),
        payload,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: workItemKeys.comments(workItemId) });
    },
  });
}

/** DELETE /api/work-items/:id/comments/:comment_id — 204 */
export function useDeleteWorkItemComment(workItemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) =>
      api.delete<void>(
        API_ENDPOINTS.WORK_ITEM_COMMENT_BY_ID(workItemId, commentId),
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: workItemKeys.comments(workItemId) });
    },
  });
}
