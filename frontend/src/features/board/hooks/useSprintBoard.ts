"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { api } from "@/lib/api";
import { API_ENDPOINTS } from "@/types";
import type {
  Sprint,
  WorkItemListItem,
  WorkItem,
  AgileListResponse,
  BoardColumn as BoardColumnDef,
  WorkItemStatus,
} from "@/types";
import type { CreateWorkItemPayload } from "@/features/agile/types";
import { useBoardStore, type BoardColumn } from "../store";

// ─── Color -> Tailwind accent class ──────────────────────────────────────────

/** Map a hex color to the closest named Tailwind border-color class.
 *  The 5 seeded defaults each have a known color; custom columns fall back
 *  to a neutral border. */
function colorToAccentClass(color: string | null): string {
  if (!color) return "border-border";
  const map: Record<string, string> = {
    "#94a3b8": "border-slate-400",
    "#8b5cf6": "border-violet-500",
    "#0ea5e9": "border-sky-500",
    "#f59e0b": "border-amber-500",
    "#10b981": "border-emerald-500",
  };
  return map[color.toLowerCase()] ?? "border-primary/60";
}

// ─── Query keys ───────────────────────────────────────────────────────────────

export const boardKeys = {
  all: ["board"] as const,
  columns: (projectId: string | null) =>
    [...boardKeys.all, "columns", projectId ?? "all"] as const,
  activeSprint: () => [...boardKeys.all, "active-sprint"] as const,
  sprintItems: (sprintId: string) =>
    [...boardKeys.all, "sprint-items", sprintId] as const,
  items: (projectId: string | null) =>
    [...boardKeys.all, "items", projectId ?? "all"] as const,
};

// ─── useBoardColumns — GET + lazy-seed + hydrate store ───────────────────────

export function useBoardColumns(projectId: string | null) {
  return useQuery<BoardColumnDef[]>({
    queryKey: boardKeys.columns(projectId),
    queryFn: async () => {
      const params = projectId ? { project_id: projectId } : {};
      return api.get<BoardColumnDef[]>(API_ENDPOINTS.BOARD_COLUMNS, params);
    },
    staleTime: 30_000,
  });
}

// ─── useCreateColumn ─────────────────────────────────────────────────────────

interface CreateColumnPayload {
  name: string;
  color?: string | null;
  project_id?: string | null;
  wip_limit?: number | null;
}

export function useCreateColumn() {
  const qc = useQueryClient();
  return useMutation<BoardColumnDef, Error, CreateColumnPayload>({
    mutationFn: (payload) =>
      api.post<BoardColumnDef>(API_ENDPOINTS.BOARD_COLUMNS, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: boardKeys.all });
    },
  });
}

// ─── useUpdateColumn ─────────────────────────────────────────────────────────

interface UpdateColumnPayload {
  id: string;
  name?: string;
  color?: string | null;
  wip_limit?: number | null;
}

export function useUpdateColumn() {
  const qc = useQueryClient();
  return useMutation<BoardColumnDef, Error, UpdateColumnPayload>({
    mutationFn: ({ id, ...body }) =>
      api.patch<BoardColumnDef>(API_ENDPOINTS.BOARD_COLUMN_BY_ID(id), body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: boardKeys.all });
    },
  });
}

// ─── useDeleteColumn ─────────────────────────────────────────────────────────

export function useDeleteColumn() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) =>
      api.delete<void>(API_ENDPOINTS.BOARD_COLUMN_BY_ID(id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: boardKeys.all });
      qc.invalidateQueries({ queryKey: ["work-items"] });
    },
  });
}

// ─── useReorderColumns ───────────────────────────────────────────────────────

export function useReorderColumns() {
  const qc = useQueryClient();
  return useMutation<void, Error, { ids: string[] }>({
    mutationFn: (body) =>
      api.put<void>(API_ENDPOINTS.BOARD_COLUMNS_REORDER, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: boardKeys.all });
    },
  });
}

// ─── useMoveItemToColumn — PATCH /work-items/:id/column ──────────────────────

export interface MoveToColumnVars {
  itemId: string;
  columnId: string | null;
  /** snapshot of all columns for rollback */
  srcColumnId: string;
  dstColumnId: string;
  dstIndex: number;
}

export function useMoveItemToColumn() {
  const qc = useQueryClient();

  return useMutation<WorkItemListItem, Error, MoveToColumnVars>({
    mutationFn: ({ itemId, columnId }) =>
      api
        .patch<WorkItem>(API_ENDPOINTS.WORK_ITEM_COLUMN(itemId), {
          column_id: columnId,
        })
        .then((wi) => ({
          id: wi.id,
          project_id: wi.project_id,
          epic_id: wi.epic_id,
          sprint_id: wi.sprint_id,
          column_id: wi.column_id,
          type: wi.type,
          title: wi.title,
          status: wi.status,
          priority: wi.priority,
          story_points: wi.story_points,
          due_date: wi.due_date,
          start_date: wi.start_date ?? null,
          labels: wi.labels ?? [],
          github_repo: wi.github_repo ?? null,
          github_branch: wi.github_branch ?? null,
          github_pr: wi.github_pr ?? null,
          pinned_fields: wi.pinned_fields ?? [],
          position: wi.position,
          subtask_count: (wi.subtasks ?? []).length,
          done_subtask_count: (wi.subtasks ?? []).filter((s) => s.is_done)
            .length,
          created_at: wi.created_at,
          updated_at: wi.updated_at,
        })),

    onMutate: ({ itemId, srcColumnId, dstColumnId, dstIndex }) => {
      const snapshot = useBoardStore.getState().columns;
      useBoardStore
        .getState()
        .moveItem(itemId, srcColumnId, dstColumnId, dstIndex);
      return { snapshot };
    },

    onError: (_err, _vars, ctx) => {
      const snap = ctx as
        | { snapshot?: ReturnType<typeof useBoardStore.getState>["columns"] }
        | undefined;
      if (snap?.snapshot) {
        useBoardStore.getState().setColumns(snap.snapshot);
      }
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: boardKeys.all });
      qc.invalidateQueries({ queryKey: ["work-items"] });
    },
  });
}

// ─── useBoardItems — fetch items + group by column_id ────────────────────────
// Fetches the board columns (lazy-seeded server-side) and work items, then
// groups items into the correct column by column_id, falling back to the
// first column for items where column_id is null.

export function useBoardItems(projectId: string | null) {
  const setColumns = useBoardStore((s) => s.setColumns);

  const columnsQuery = useBoardColumns(projectId);

  const itemsQuery = useQuery<WorkItemListItem[]>({
    queryKey: boardKeys.items(projectId),
    queryFn: async () => {
      const params = projectId
        ? { project_id: projectId, limit: 200 }
        : { limit: 200 };
      const resp = await api.get<AgileListResponse<WorkItemListItem>>(
        API_ENDPOINTS.WORK_ITEMS,
        params,
      );
      return resp.data ?? [];
    },
    staleTime: 0,
    enabled: Boolean(columnsQuery.data),
  });

  useEffect(() => {
    const apiColumns = columnsQuery.data;
    const items = itemsQuery.data;
    if (!apiColumns) return;

    const firstColId = apiColumns[0]?.id ?? null;
    // Build a set of all column IDs in the current scope so we can detect
    // items whose column_id points to a column from a different scope (e.g.,
    // a project-specific column when the board is in "All projects" mode).
    const knownColumnIds = new Set(apiColumns.map((c) => c.id));

    const boardColumns: BoardColumn[] = apiColumns.map((col) => ({
      ...col,
      accentClass: colorToAccentClass(col.color),
      items: (items ?? [])
        .filter((item) => {
          if (item.column_id === col.id) return true;
          // null column_id items fall into the first column
          if (!item.column_id && col.id === firstColId) return true;
          // Items whose column_id points to a column that is NOT in the
          // current scope (e.g. a project-specific column while viewing "All
          // projects") need a fallback: place them in the column whose
          // mapped_status matches the item's status.  If no such column
          // exists, fall back to the very first column so the item is never
          // invisible.
          if (item.column_id && !knownColumnIds.has(item.column_id)) {
            const fallback =
              apiColumns.find((c) => c.mapped_status === item.status) ??
              apiColumns[0];
            return col.id === (fallback?.id ?? firstColId);
          }
          return false;
        })
        .sort((a, b) => a.position - b.position),
    }));

    setColumns(boardColumns);
  }, [columnsQuery.data, itemsQuery.data, setColumns]);

  return {
    isLoading: columnsQuery.isLoading || itemsQuery.isLoading,
    isError: columnsQuery.isError || itemsQuery.isError,
    refetch: () => {
      columnsQuery.refetch();
      itemsQuery.refetch();
    },
  };
}

// ─── Fetch active sprint ──────────────────────────────────────────────────────

export function useActiveSprint() {
  return useQuery<Sprint | null>({
    queryKey: boardKeys.activeSprint(),
    queryFn: async () => {
      try {
        return await api.get<Sprint>(API_ENDPOINTS.SPRINT_ACTIVE);
      } catch (err) {
        const status = (err as { status?: number }).status;
        if (status === 404) return null;
        throw err;
      }
    },
    staleTime: 30_000,
  });
}

// ─── useSprintBoard — sprint-scoped items grouped into board columns ──────────

export function useSprintBoard(sprintId: string) {
  const setColumns = useBoardStore((s) => s.setColumns);
  const columnsQuery = useBoardColumns(null); // sprint board is not project-scoped

  const query = useQuery<WorkItemListItem[]>({
    queryKey: boardKeys.sprintItems(sprintId),
    queryFn: async () => {
      const resp = await api.get<AgileListResponse<WorkItemListItem>>(
        API_ENDPOINTS.SPRINT_WORK_ITEMS(sprintId),
      );
      return resp.data ?? [];
    },
    enabled: Boolean(sprintId) && Boolean(columnsQuery.data),
    staleTime: 0,
  });

  useEffect(() => {
    const apiColumns = columnsQuery.data;
    const items = query.data;
    if (!apiColumns) return;

    const firstColId = apiColumns[0]?.id ?? null;
    const knownColumnIds = new Set(apiColumns.map((c) => c.id));

    const boardColumns: BoardColumn[] = apiColumns.map((col) => ({
      ...col,
      accentClass: colorToAccentClass(col.color),
      items: (items ?? [])
        .filter((item) => {
          if (item.column_id === col.id) return true;
          if (!item.column_id && col.id === firstColId) return true;
          // Fallback for items whose column_id belongs to a different scope
          if (item.column_id && !knownColumnIds.has(item.column_id)) {
            const fallback =
              apiColumns.find((c) => c.mapped_status === item.status) ??
              apiColumns[0];
            return col.id === (fallback?.id ?? firstColId);
          }
          return false;
        })
        .sort((a, b) => a.position - b.position),
    }));

    setColumns(boardColumns);
  }, [columnsQuery.data, query.data, setColumns]);

  return query;
}

// ─── useMoveItem (legacy alias) ───────────────────────────────────────────────
// Kept so WorkItemDetailSheet + any remaining callers continue to compile.
// The board DnD now calls useMoveItemToColumn instead.

interface MoveItemVars {
  itemId: string;
  newStatus: WorkItemStatus;
  srcStatus: WorkItemStatus;
  dstStatus: WorkItemStatus;
  dstIndex: number;
  sprintId: string;
}

export function useMoveItem() {
  const qc = useQueryClient();

  return useMutation<WorkItemListItem, Error, MoveItemVars>({
    mutationFn: ({ itemId, newStatus }) =>
      api
        .patch<WorkItem>(API_ENDPOINTS.WORK_ITEM_STATUS(itemId), {
          status: newStatus,
        })
        .then((wi) => ({
          id: wi.id,
          project_id: wi.project_id,
          epic_id: wi.epic_id,
          sprint_id: wi.sprint_id,
          column_id: wi.column_id,
          type: wi.type,
          title: wi.title,
          status: wi.status,
          priority: wi.priority,
          story_points: wi.story_points,
          due_date: wi.due_date,
          start_date: wi.start_date ?? null,
          labels: wi.labels ?? [],
          github_repo: wi.github_repo ?? null,
          github_branch: wi.github_branch ?? null,
          github_pr: wi.github_pr ?? null,
          pinned_fields: wi.pinned_fields ?? [],
          position: wi.position,
          subtask_count: (wi.subtasks ?? []).length,
          done_subtask_count: (wi.subtasks ?? []).filter((s) => s.is_done)
            .length,
          created_at: wi.created_at,
          updated_at: wi.updated_at,
        })),

    onSettled: () => {
      qc.invalidateQueries({ queryKey: boardKeys.all });
      qc.invalidateQueries({ queryKey: ["work-items"] });
    },
  });
}

// ─── Quick-create work item in a column ───────────────────────────────────────

export function useCreateBoardItem(sprintId: string) {
  const qc = useQueryClient();

  return useMutation<WorkItem, Error, CreateWorkItemPayload>({
    mutationFn: (payload) =>
      api.post<WorkItem>(API_ENDPOINTS.WORK_ITEMS, {
        ...payload,
        sprint_id: sprintId || null,
      }),

    onSuccess: (wi) => {
      const listItem: WorkItemListItem = {
        id: wi.id,
        project_id: wi.project_id,
        epic_id: wi.epic_id,
        sprint_id: wi.sprint_id,
        column_id: wi.column_id,
        type: wi.type,
        title: wi.title,
        status: wi.status,
        priority: wi.priority,
        story_points: wi.story_points,
        due_date: wi.due_date,
        start_date: wi.start_date ?? null,
        labels: wi.labels ?? [],
        github_repo: wi.github_repo ?? null,
        github_branch: wi.github_branch ?? null,
        github_pr: wi.github_pr ?? null,
        pinned_fields: wi.pinned_fields ?? [],
        position: wi.position,
        subtask_count: 0,
        done_subtask_count: 0,
        created_at: wi.created_at,
        updated_at: wi.updated_at,
      };
      useBoardStore.getState().appendItem(listItem);

      qc.invalidateQueries({ queryKey: boardKeys.all });
      qc.invalidateQueries({ queryKey: ["work-items"] });
    },
  });
}

// ─── BOARD_COLUMNS const (kept for any external callers that import it) ───────
// The runtime column config now comes from the API; this stub prevents import
// errors in case any file still references BOARD_COLUMNS.
export const BOARD_COLUMNS: never[] = [];
