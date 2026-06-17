import type { Priority, TaskStatus } from "@/types";

// ─── Request payloads ──────────────────────────────────────────────────────────

export interface CreateTaskPayload {
  title: string;
  description?: string | null;
  priority?: Priority;
  status?: TaskStatus;
  due_date?: string | null;
  start_date?: string | null;
  estimated_time?: number | null; // minutes
  project_id?: string | null;
  tag_ids?: string[];
  recurrence_rule?: string | null;
}

export interface UpdateTaskPayload extends Partial<CreateTaskPayload> {}

export interface CreateSubtaskPayload {
  title: string;
}

export interface UpdateSubtaskPayload {
  title?: string;
  is_done?: boolean;
  position?: number;
}

// ─── Filter / query params ─────────────────────────────────────────────────────

export interface TaskFiltersState {
  search: string;
  status: TaskStatus | "all";
  priority: Priority | "all";
  project_id: string | "all";
  tag_id: string | "all";
  /** "today" | "overdue" | "upcoming" | "no_date" | undefined */
  due_filter: "today" | "overdue" | "upcoming" | "no_date" | "all";
  sort_by: "due_date" | "priority" | "created_at" | "title";
  sort_dir: "asc" | "desc";
}

export type TaskFilterKey = keyof TaskFiltersState;
