"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS } from "@/types";
import type { Task, TaskStatus } from "@/types";
import type { CreateCardPayload, UpdateCardPayload } from "../types";
import { KANBAN_COLUMNS_KEY } from "./useKanbanColumns";
import { useKanbanStore } from "../store";

// ─── Create task (card) inside a column ───────────────────────────────────────

export function useCreateCard(columnId: TaskStatus) {
  const qc = useQueryClient();

  return useMutation<Task, Error, CreateCardPayload>({
    mutationFn: (body) =>
      // POST /api/tasks → 201 + flat TaskResponse (no wrapper)
      api.post<Task>(API_ENDPOINTS.TASKS, {
        ...body,
        // Set status to match the column the card is being added to
        status: columnId,
      }),

    onSuccess: (task) => {
      useKanbanStore.getState().appendCard(columnId, task);
      qc.invalidateQueries({ queryKey: KANBAN_COLUMNS_KEY });
    },
  });
}

// ─── Update task (card) ───────────────────────────────────────────────────────

export function useUpdateCard() {
  const qc = useQueryClient();

  return useMutation<Task, Error, { taskId: string; payload: UpdateCardPayload }>({
    mutationFn: ({ taskId, payload }) =>
      // PATCH /api/tasks/:id → flat TaskResponse (no wrapper)
      api.patch<Task>(API_ENDPOINTS.TASK_BY_ID(taskId), payload),

    onSuccess: (updatedTask) => {
      // Find which column holds this task and update it in place
      const store = useKanbanStore.getState();
      const col = store.columns.find((c) =>
        (c.tasks ?? []).some((t) => t.id === updatedTask.id),
      );
      if (col) {
        store.updateCard(col.id, updatedTask);
      }
      qc.invalidateQueries({ queryKey: KANBAN_COLUMNS_KEY });
    },
  });
}

// ─── Delete task (card) ───────────────────────────────────────────────────────

export function useDeleteCard() {
  const qc = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (taskId) =>
      // DELETE /api/tasks/:id → 204 No Content
      api.delete<void>(API_ENDPOINTS.TASK_BY_ID(taskId)),

    onMutate: (taskId) => {
      const store = useKanbanStore.getState();
      const snapshot = store.columns;
      store.removeCard(taskId);
      return { snapshot };
    },

    onError: (_err, _id, ctx) => {
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
