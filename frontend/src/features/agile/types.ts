import type {
  Priority,
  WorkItemStatus,
  WorkItemType,
  SprintStatus,
  EpicStatus,
  InitiativeStatus,
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

export interface MoveWorkItemToSprintPayload {
  sprint_id: string;
  position?: number;
}

export interface MoveWorkItemToBacklogPayload {
  position?: number;
}

export interface CreateWorkItemSubtaskPayload {
  title: string;
}

export interface UpdateWorkItemSubtaskPayload {
  title?: string;
  is_done?: boolean;
  position?: number;
}

// ── Sprint ────────────────────────────────────────────────────────────────────

export interface CreateSprintPayload {
  name: string;
  goal_text?: string | null;
  start_date: string;
  end_date: string;
  capacity_points?: number;
  project_id?: string | null;
}

export interface UpdateSprintPayload extends Partial<CreateSprintPayload> {
  status?: SprintStatus;
}

export interface CompleteSprintPayload {
  summary?: string;
}

export interface UpsertSprintReviewPayload {
  summary?: string;
}

export interface UpsertRetrospectivePayload {
  went_well?: string;
  went_wrong?: string;
  action_items?: { id: string; text: string; done?: boolean }[];
}

// ── Epic ──────────────────────────────────────────────────────────────────────

export interface CreateEpicPayload {
  initiative_id: string;
  title: string;
  description?: string | null;
  status?: EpicStatus;
  start_date?: string | null;
  due_date?: string | null;
  color?: string | null;
  position?: number;
}

export interface UpdateEpicPayload extends Partial<Omit<CreateEpicPayload, "initiative_id">> {}

// ── Initiative ────────────────────────────────────────────────────────────────

export interface CreateInitiativePayload {
  goal_id: string;
  title: string;
  description?: string | null;
  status?: InitiativeStatus;
  color?: string | null;
  position?: number;
}

export interface UpdateInitiativePayload
  extends Partial<Omit<CreateInitiativePayload, "goal_id">> {
  goal_id?: string;
}

// ─── Filter state ─────────────────────────────────────────────────────────────

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
