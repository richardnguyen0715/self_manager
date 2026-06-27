"use client";

import { create } from "zustand";
import type { TaskFiltersState } from "./types";

// ─── Task UI Store ─────────────────────────────────────────────────────────────

interface TaskUIState {
  // Dialog state
  isCreateDialogOpen: boolean;
  isEditDialogOpen: boolean;
  /** ID of the task being edited — null means create mode */
  editingTaskId: string | null;

  // Detail panel
  selectedTaskId: string | null;

  /**
   * Optional values to pre-fill when opening the create dialog — e.g. the
   * Calendar passes a `due_date` when a day/slot is clicked so the new task
   * lands on that date. Cleared on close.
   */
  createPrefill: { due_date?: string } | null;

  // Active filters
  filters: TaskFiltersState;

  // Actions
  openCreateDialog: (prefill?: { due_date?: string }) => void;
  openEditDialog: (taskId: string) => void;
  closeDialog: () => void;

  selectTask: (id: string | null) => void;

  setFilter: <K extends keyof TaskFiltersState>(
    key: K,
    value: TaskFiltersState[K],
  ) => void;
  resetFilters: () => void;
}

const DEFAULT_FILTERS: TaskFiltersState = {
  search: "",
  status: "all",
  priority: "all",
  project_id: "all",
  tag_id: "all",
  due_filter: "all",
  sort_by: "created_at",
  sort_dir: "desc",
};

export const useTaskUIStore = create<TaskUIState>((set) => ({
  isCreateDialogOpen: false,
  isEditDialogOpen: false,
  editingTaskId: null,
  selectedTaskId: null,
  createPrefill: null,
  filters: { ...DEFAULT_FILTERS },

  openCreateDialog: (prefill) =>
    set({
      isCreateDialogOpen: true,
      editingTaskId: null,
      createPrefill: prefill ?? null,
    }),

  openEditDialog: (taskId) =>
    set({ isEditDialogOpen: true, editingTaskId: taskId }),

  closeDialog: () =>
    set({
      isCreateDialogOpen: false,
      isEditDialogOpen: false,
      editingTaskId: null,
      createPrefill: null,
    }),

  selectTask: (id) => set({ selectedTaskId: id }),

  setFilter: (key, value) =>
    set((state) => ({
      filters: { ...state.filters, [key]: value },
    })),

  resetFilters: () => set({ filters: { ...DEFAULT_FILTERS } }),
}));
