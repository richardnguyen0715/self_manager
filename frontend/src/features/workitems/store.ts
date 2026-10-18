"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
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

// ─── Work Item Display Options (Plane-style "Display" menu) ───────────────────

export type WorkItemGroupBy = "none" | "status" | "priority" | "type";
export type WorkItemOrderBy = "created" | "updated" | "priority" | "due_date" | "title";
export type WorkItemOrderDir = "asc" | "desc";

export interface WorkItemDisplayProperties {
  status: boolean;
  priority: boolean;
  points: boolean;
  due: boolean;
}

interface WorkItemDisplayState {
  groupBy: WorkItemGroupBy;
  orderBy: WorkItemOrderBy;
  orderDir: WorkItemOrderDir;
  properties: WorkItemDisplayProperties;

  setDisplay: (patch: Partial<Omit<WorkItemDisplayState, "setDisplay">>) => void;
}

/** Persisted to localStorage under `mml_wi_display`. */
export const useWorkItemDisplayStore = create<WorkItemDisplayState>()(
  persist(
    (set) => ({
      groupBy: "none",
      orderBy: "created",
      orderDir: "desc",
      properties: { status: true, priority: true, points: true, due: true },
      setDisplay: (patch) => set(patch),
    }),
    { name: "mml_wi_display" },
  ),
);
