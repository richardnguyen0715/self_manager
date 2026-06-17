"use client";

import { create } from "zustand";
import type { TaskStatus, Task } from "@/types";
import type { KanbanColumn } from "./types";

// ─── Optimistic column state ───────────────────────────────────────────────────

interface KanbanUIState {
  /** columns ordered by position, each with an inlined tasks array */
  columns: KanbanColumn[];

  /** id of the card whose detail dialog is open */
  openCardId: string | null;

  /** id of the column the "add card" form is open for */
  addingCardToColumnId: TaskStatus | null;

  /** whether the board is in a "processing drag" state (blocks duplicate drops) */
  isDragging: boolean;

  // ─── Actions ─────────────────────────────────────────────────────────────────

  setColumns: (columns: KanbanColumn[]) => void;

  /** Optimistically move a card between columns or reposition within a column */
  moveCard: (
    taskId: string,
    srcColumnId: TaskStatus,
    dstColumnId: TaskStatus,
    dstIndex: number,
  ) => void;

  /** Replace a single card's data (e.g. after a successful mutation) */
  updateCard: (columnId: TaskStatus, task: Task) => void;

  /** Remove a card optimistically */
  removeCard: (taskId: string) => void;

  /** Append a new card to the specified column */
  appendCard: (columnId: TaskStatus, task: Task) => void;

  openCardDetail: (taskId: string) => void;
  closeCardDetail: () => void;

  openAddCard: (columnId: TaskStatus) => void;
  closeAddCard: () => void;

  setIsDragging: (v: boolean) => void;
}

export const useKanbanStore = create<KanbanUIState>((set, get) => ({
  columns: [],
  openCardId: null,
  addingCardToColumnId: null,
  isDragging: false,

  setColumns: (columns) => set({ columns }),

  moveCard: (taskId, srcColumnId, dstColumnId, dstIndex) => {
    const cols = get().columns.map((c) => ({ ...c, tasks: [...(c.tasks ?? [])] }));

    const srcCol = cols.find((c) => c.id === srcColumnId);
    const dstCol = cols.find((c) => c.id === dstColumnId);
    if (!srcCol || !dstCol) return;

    const srcTasks = srcCol.tasks ?? [];
    const taskIdx = srcTasks.findIndex((t) => t.id === taskId);
    if (taskIdx === -1) return;

    const [task] = srcTasks.splice(taskIdx, 1);
    srcCol.tasks = srcTasks;

    const dstTasks = dstCol.tasks ?? [];
    dstTasks.splice(dstIndex, 0, task);
    dstCol.tasks = dstTasks;

    set({ columns: cols });
  },

  updateCard: (columnId, task) => {
    set((state) => ({
      columns: state.columns.map((col) => {
        if (col.id !== columnId) return col;
        return {
          ...col,
          tasks: (col.tasks ?? []).map((t) => (t.id === task.id ? task : t)),
        };
      }),
    }));
  },

  removeCard: (taskId) => {
    set((state) => ({
      columns: state.columns.map((col) => ({
        ...col,
        tasks: (col.tasks ?? []).filter((t) => t.id !== taskId),
      })),
    }));
  },

  appendCard: (columnId, task) => {
    set((state) => ({
      columns: state.columns.map((col) => {
        if (col.id !== columnId) return col;
        return { ...col, tasks: [...(col.tasks ?? []), task] };
      }),
    }));
  },

  openCardDetail: (taskId) => set({ openCardId: taskId }),
  closeCardDetail: () => set({ openCardId: null }),

  openAddCard: (columnId) => set({ addingCardToColumnId: columnId }),
  closeAddCard: () => set({ addingCardToColumnId: null }),

  setIsDragging: (v) => set({ isDragging: v }),
}));
