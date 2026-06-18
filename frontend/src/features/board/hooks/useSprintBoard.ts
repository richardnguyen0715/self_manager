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
  WorkItemStatus,
} from "@/types";
import type { CreateWorkItemPayload } from "@/features/agile/types";
import { useBoardStore, type BoardColumn } from "../store";

// ─── Column configuration ─────────────────────────────────────────────────────

export const BOARD_COLUMNS: Pick<BoardColumn, "status" | "label" | "accentClass">[] = [
  {
    status: "todo",
    label: "To Do",
    accentClass: "border-violet-500",
  },
  {
    status: "in_progress",
    label: "In Progress",
    accentClass: "border-sky-500",
  },
  {
    status: "review",
    label: "In Review",
    accentClass: "border-amber-500",
  },
  {
    status: "done",
    label: "Done",
    accentClass: "border-emerald-500",
  },
];

// ─── Query keys ───────────────────────────────────────────────────────────────

export const boardKeys = {
  all: ["board"] as const,
  activeSprint: () => [...boardKeys.all, "active-sprint"] as const,
  sprintItems: (sprintId: string) =>
    [...boardKeys.all, "sprint-items", sprintId] as const,
};

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

// ─── Fetch sprint work items + hydrate store ──────────────────────────────────

export function useSprintBoard(sprintId: string) {
  const setColumns = useBoardStore((s) => s.setColumns);

  const query = useQuery<BoardColumn[]>({
    queryKey: boardKeys.sprintItems(sprintId),
    queryFn: async () => {
      // GET /api/sprints/:id/work-items → { data: WorkItemListItem[], total }
      const resp = await api.get<AgileListResponse<WorkItemListItem>>(
        API_ENDPOINTS.SPRINT_WORK_ITEMS(sprintId),
      );
      const items = resp.data ?? [];

      return BOARD_COLUMNS.map((col) => ({
        ...col,
        items: items
          .filter((i) => i.status === col.status)
          .sort((a, b) => a.position - b.position),
      }));
    },
    enabled: Boolean(sprintId),
    staleTime: 0,
  });

  // Sync server state into local optimistic store
  useEffect(() => {
    if (query.data) {
      setColumns(query.data);
    }
  }, [query.data, setColumns]);

  return query;
}

// ─── Move (status change) mutation ───────────────────────────────────────────

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
      // PATCH /api/work-items/:id/status { status } → flat WorkItem
      api
        .patch<WorkItem>(API_ENDPOINTS.WORK_ITEM_STATUS(itemId), {
          status: newStatus,
        })
        .then((wi) => ({
          id: wi.id,
          project_id: wi.project_id,
          epic_id: wi.epic_id,
          sprint_id: wi.sprint_id,
          type: wi.type,
          title: wi.title,
          status: wi.status,
          priority: wi.priority,
          story_points: wi.story_points,
          due_date: wi.due_date,
          position: wi.position,
          subtask_count: (wi.subtasks ?? []).length,
          done_subtask_count: (wi.subtasks ?? []).filter((s) => s.is_done).length,
          created_at: wi.created_at,
          updated_at: wi.updated_at,
        })),

    onMutate: ({ itemId, srcStatus, dstStatus, dstIndex }) => {
      // Optimistic move is already applied on drag-over; snapshot for rollback
      const snapshot = useBoardStore.getState().columns;
      useBoardStore.getState().moveItem(itemId, srcStatus, dstStatus, dstIndex);
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

    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({
        queryKey: boardKeys.sprintItems(vars.sprintId),
      });
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
        sprint_id: sprintId,
      }),

    onSuccess: (wi) => {
      // Map full WorkItem → WorkItemListItem and append optimistically
      const listItem: WorkItemListItem = {
        id: wi.id,
        project_id: wi.project_id,
        epic_id: wi.epic_id,
        sprint_id: wi.sprint_id,
        type: wi.type,
        title: wi.title,
        status: wi.status,
        priority: wi.priority,
        story_points: wi.story_points,
        due_date: wi.due_date,
        position: wi.position,
        subtask_count: 0,
        done_subtask_count: 0,
        created_at: wi.created_at,
        updated_at: wi.updated_at,
      };
      useBoardStore.getState().appendItem(listItem);

      qc.invalidateQueries({ queryKey: boardKeys.sprintItems(sprintId) });
    },
  });
}
