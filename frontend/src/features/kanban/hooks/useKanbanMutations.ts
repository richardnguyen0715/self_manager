"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS } from "@/types";
import type { Task, TaskStatus } from "@/types";
import { KANBAN_COLUMNS_KEY } from "./useKanbanColumns";
import { useKanbanStore } from "../store";

// ─── Move card between columns (status change) ────────────────────────────────

interface MoveCardVars {
  taskId: string;
  /** Destination status (= destination column id) */
  newStatus: TaskStatus;
  srcColumnId: TaskStatus;
  dstColumnId: TaskStatus;
  dstIndex: number;
}

export function useMoveCard() {
  const qc = useQueryClient();

  return useMutation<Task, Error, MoveCardVars>({
    mutationFn: ({ taskId, newStatus }) =>
      // PATCH /api/tasks/:id { status } → flat TaskResponse (no wrapper)
      api.patch<Task>(API_ENDPOINTS.TASK_BY_ID(taskId), { status: newStatus }),

    onMutate: ({ taskId, srcColumnId, dstColumnId, dstIndex }) => {
      const store = useKanbanStore.getState();
      const snapshot = store.columns;
      store.moveCard(taskId, srcColumnId, dstColumnId, dstIndex);
      return { snapshot };
    },

    onError: (_err, _vars, ctx) => {
      const snap = ctx as { snapshot?: ReturnType<typeof useKanbanStore.getState>["columns"] } | undefined;
      if (snap?.snapshot) {
        useKanbanStore.getState().setColumns(snap.snapshot);
      }
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: KANBAN_COLUMNS_KEY });
    },
  });
}
