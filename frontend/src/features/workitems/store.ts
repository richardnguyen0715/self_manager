"use client";

import { create } from "zustand";
import type { WorkItemFiltersState } from "./types";

// ─── Work Item UI Store ────────────────────────────────────────────────────────

interface WorkItemUIState {
  // Dialog / panel state
  isCreateDialogOpen: boolean;
  isLinkDialogOpen: boolean;

  // Active filters for the list view
  filters: WorkItemFiltersState;

  // Actions
  openCreateDialog: () => void;
  closeCreateDialog: () => void;
  openLinkDialog: () => void;
  closeLinkDialog: () => void;

  setFilter: <K extends keyof WorkItemFiltersState>(
    key: K,
    value: WorkItemFiltersState[K],
  ) => void;
  resetFilters: () => void;
}

const DEFAULT_FILTERS: WorkItemFiltersState = {
  status: "all",
  type: "all",
  priority: "all",
  search: "",
};

export const useWorkItemUIStore = create<WorkItemUIState>((set) => ({
  isCreateDialogOpen: false,
  isLinkDialogOpen: false,
  filters: { ...DEFAULT_FILTERS },

  openCreateDialog: () => set({ isCreateDialogOpen: true }),
  closeCreateDialog: () => set({ isCreateDialogOpen: false }),
  openLinkDialog: () => set({ isLinkDialogOpen: true }),
  closeLinkDialog: () => set({ isLinkDialogOpen: false }),

  setFilter: (key, value) =>
    set((state) => ({
      filters: { ...state.filters, [key]: value },
    })),

  resetFilters: () => set({ filters: { ...DEFAULT_FILTERS } }),
}));
