"use client";

import { create } from "zustand";
import type { SprintFiltersState, SprintDetailTab } from "./types";

// ─── Sprint UI Store ───────────────────────────────────────────────────────────

interface SprintUIState {
  // Sprint create / edit dialog
  isCreateDialogOpen: boolean;
  isEditDialogOpen: boolean;
  editingSprintId: string | null;

  // Complete sprint dialog
  isCompleteDialogOpen: boolean;
  completingSprintId: string | null;

  // Sprint work item picker (planning panel)
  isPlanningPanelOpen: boolean;
  planningSprintId: string | null;

  // Detail tab
  activeDetailTab: SprintDetailTab;

  // Filters (sprints list)
  filters: SprintFiltersState;

  // Actions
  openCreateDialog: () => void;
  openEditDialog: (sprintId: string) => void;
  openCompleteDialog: (sprintId: string) => void;
  openPlanningPanel: (sprintId: string) => void;
  closeDialog: () => void;
  closePlanningPanel: () => void;
  setDetailTab: (tab: SprintDetailTab) => void;
  setFilter: <K extends keyof SprintFiltersState>(
    key: K,
    value: SprintFiltersState[K],
  ) => void;
  resetFilters: () => void;
}

const DEFAULT_FILTERS: SprintFiltersState = {
  status: "all",
};

export const useSprintUIStore = create<SprintUIState>((set) => ({
  isCreateDialogOpen: false,
  isEditDialogOpen: false,
  editingSprintId: null,
  isCompleteDialogOpen: false,
  completingSprintId: null,
  isPlanningPanelOpen: false,
  planningSprintId: null,
  activeDetailTab: "overview",
  filters: { ...DEFAULT_FILTERS },

  openCreateDialog: () =>
    set({ isCreateDialogOpen: true, editingSprintId: null }),

  openEditDialog: (sprintId) =>
    set({ isEditDialogOpen: true, editingSprintId: sprintId }),

  openCompleteDialog: (sprintId) =>
    set({ isCompleteDialogOpen: true, completingSprintId: sprintId }),

  openPlanningPanel: (sprintId) =>
    set({ isPlanningPanelOpen: true, planningSprintId: sprintId }),

  closeDialog: () =>
    set({
      isCreateDialogOpen: false,
      isEditDialogOpen: false,
      editingSprintId: null,
      isCompleteDialogOpen: false,
      completingSprintId: null,
    }),

  closePlanningPanel: () =>
    set({ isPlanningPanelOpen: false, planningSprintId: null }),

  setDetailTab: (tab) => set({ activeDetailTab: tab }),

  setFilter: (key, value) =>
    set((state) => ({ filters: { ...state.filters, [key]: value } })),

  resetFilters: () => set({ filters: { ...DEFAULT_FILTERS } }),
}));
