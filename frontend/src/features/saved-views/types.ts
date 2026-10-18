// ─── Saved views (Plane-style) ────────────────────────────────────────────────
//
// A saved view is a named bundle of filters (and, later, display options) for
// a scope. Backed by `/api/saved-views` (migration 0017_saved_views).

import type { WorkItemType, WorkItemStatus, Priority } from "@/types";

export type SavedViewScope = "work_items" | "backlog" | "board";

/** Filter fields a work-items saved view captures. */
export interface SavedViewFilters {
  type: WorkItemType | "all";
  status: WorkItemStatus | "all";
  priority: Priority | "all";
  search: string;
}

export interface SavedView {
  id: string;
  user_id: string;
  project_id: string | null;
  name: string;
  scope: SavedViewScope;
  /** Stored as JSON; may be partial for older rows, so read defensively. */
  filters: Partial<SavedViewFilters>;
  display: Record<string, unknown>;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface CreateSavedViewPayload {
  name: string;
  scope?: SavedViewScope;
  project_id?: string | null;
  filters?: SavedViewFilters;
  display?: Record<string, unknown>;
}

export interface UpdateSavedViewPayload {
  name?: string;
  filters?: SavedViewFilters;
  display?: Record<string, unknown>;
  position?: number;
}

export const DEFAULT_SAVED_VIEW_FILTERS: SavedViewFilters = {
  type: "all",
  status: "all",
  priority: "all",
  search: "",
};

/** Fill in defaults for any missing keys of a stored filter blob. */
export function normalizeSavedViewFilters(
  raw: Partial<SavedViewFilters> | null | undefined,
): SavedViewFilters {
  return {
    type: raw?.type ?? "all",
    status: raw?.status ?? "all",
    priority: raw?.priority ?? "all",
    search: raw?.search ?? "",
  };
}

export function sameSavedViewFilters(
  a: SavedViewFilters,
  b: SavedViewFilters,
): boolean {
  return (
    a.type === b.type &&
    a.status === b.status &&
    a.priority === b.priority &&
    a.search.trim() === b.search.trim()
  );
}
