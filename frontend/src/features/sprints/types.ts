import type {
  SprintStatus,
  SprintReview,
  WorkItemType,
  WorkItemStatus,
  Priority,
} from "@/types";

/** What happens to work items that are not done when a sprint completes. */
export type UnfinishedItemsAction = "backlog" | "next_sprint" | "keep";

/** Response of POST /api/sprints/:id/complete. */
export interface CompleteSprintResult extends SprintReview {
  moved_count: number;
}

// ─── Sprint form payloads ─────────────────────────────────────────────────────

export interface CreateSprintFormValues {
  name: string;
  goal_text: string;
  start_date: string;
  end_date: string;
  capacity_points: number;
}

export interface UpdateSprintFormValues extends Partial<CreateSprintFormValues> {
  status?: SprintStatus;
}

export interface CompleteSprintFormValues {
  summary: string;
}

export interface UpsertRetrospectiveFormValues {
  went_well: string;
  went_wrong: string;
}

// ─── Sprint planning / work item pick payloads ────────────────────────────────

export interface MoveItemToSprintPayload {
  sprint_id: string;
  position?: number;
}

export interface MoveItemToBacklogPayload {
  position?: number;
}

// ─── Filter state ─────────────────────────────────────────────────────────────

export interface SprintFiltersState {
  status?: SprintStatus | "all";
}

export interface SprintWorkItemFiltersState {
  status?: WorkItemStatus | "all";
  type?: WorkItemType | "all";
  priority?: Priority | "all";
}

// ─── UI state ─────────────────────────────────────────────────────────────────

export type SprintDetailTab = "overview" | "planning" | "review" | "retrospective" | "burndown";
