import type {
  Priority,
  WorkItemStatus,
  WorkItemType,
} from "@/types";

// ─── Request payloads ──────────────────────────────────────────────────────────

export interface CreateWorkItemPayload {
  title: string;
  description?: string | null;
  type?: WorkItemType;
  epic_id?: string | null;
  sprint_id?: string | null;
  project_id?: string | null;
  status?: WorkItemStatus;
  priority?: Priority;
  story_points?: number | null;
  due_date?: string | null;
  start_date?: string | null;
  labels?: string[];
  github_repo?: string | null;
  github_branch?: string | null;
  github_pr?: string | null;
  /** Detail-field keys pinned to show on the board card. */
  pinned_fields?: string[];
  recurrence_rule?: string | null;
}

export interface UpdateWorkItemPayload extends Partial<CreateWorkItemPayload> {
  position?: number;
}

export interface SetWorkItemStatusPayload {
  status: WorkItemStatus;
}

export interface SetWorkItemPointsPayload {
  story_points: number | null;
}

export interface CreateWorkItemSubtaskPayload {
  title: string;
}

export interface UpdateWorkItemSubtaskPayload {
  title?: string;
  is_done?: boolean;
  position?: number;
}

// ─── Linked items / web-links / attachments ────────────────────────────────────

export interface WorkItemLink {
  id: string;
  work_item_id: string;
  target_work_item_id: string;
  link_type: string;
  target_title: string;
  target_type: string;
  target_status: string;
  created_at: string;
}

export interface AddWorkItemLinkPayload {
  target_work_item_id: string;
  link_type?: string;
}

export interface WorkItemWebLink {
  id: string;
  work_item_id: string;
  url: string;
  title: string | null;
  created_at: string;
}

export interface AddWebLinkPayload {
  url: string;
  title?: string;
}

export interface WorkItemAttachment {
  id: string;
  work_item_id: string;
  filename: string;
  url: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
}

// ─── Filter state ─────────────────────────────────────────────────────────────

/** Body for POST /api/work-items/bulk — mirrors BulkPatch on the backend. */
export interface BulkWorkItemPatch {
  status?: WorkItemStatus;
  priority?: Priority;
  type?: WorkItemType;
  sprint_id?: string;
  clear_sprint?: boolean;
  story_points?: number;
  clear_story_points?: boolean;
  add_labels?: string[];
  remove_labels?: string[];
}

export interface BulkWorkItemPayload {
  ids: string[];
  action: "update" | "delete";
  patch?: BulkWorkItemPatch;
}

export interface BulkWorkItemResult {
  updated: number;
}

export interface WorkItemFiltersState {
  sprint_id?: string;
  epic_id?: string;
  project_id?: string | null;
  status?: WorkItemStatus | "all";
  type?: WorkItemType | "all";
  priority?: Priority | "all";
  search?: string;
  limit?: number;
  offset?: number;
}
