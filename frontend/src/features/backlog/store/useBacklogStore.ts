"use client";

import { create } from "zustand";
import type { WorkItemType, WorkItemStatus, Priority } from "@/types";

// ─── Backlog filter state ─────────────────────────────────────────────────────

export interface BacklogFiltersState {
  search: string;
  type: WorkItemType | "all";
  priority: Priority | "all";
  epic_id: string | "all";
}

// ─── Dialog modes ─────────────────────────────────────────────────────────────

export type BacklogDialogMode =
  | { kind: "closed" }
  | { kind: "create_item"; sprint_id?: string } // quick-add to backlog or specific sprint
  | { kind: "create_sprint" }
  | { kind: "assign_sprint"; workItemId: string }; // move item to sprint picker

// ─── Store ────────────────────────────────────────────────────────────────────

interface BacklogUIState {
  filters: BacklogFiltersState;
  dialog: BacklogDialogMode;
  /** Collapsed sprint sections keyed by sprint id */
  collapsedSprints: Record<string, boolean>;
  backlogCollapsed: boolean;

  // Filter actions
  setFilter: <K extends keyof BacklogFiltersState>(
    key: K,
    value: BacklogFiltersState[K],
  ) => void;
  resetFilters: () => void;

  // Dialog actions
  openCreateItem: (sprint_id?: string) => void;
  openCreateSprint: () => void;
  openAssignSprint: (workItemId: string) => void;
  closeDialog: () => void;

  // Collapse actions
  toggleSprintCollapse: (sprintId: string) => void;
  toggleBacklogCollapse: () => void;
}

const DEFAULT_FILTERS: BacklogFiltersState = {
  search: "",
  type: "all",
  priority: "all",
  epic_id: "all",
};

export const useBacklogStore = create<BacklogUIState>((set) => ({
  filters: { ...DEFAULT_FILTERS },
  dialog: { kind: "closed" },
  collapsedSprints: {},
  backlogCollapsed: false,

  setFilter: (key, value) =>
    set((state) => ({ filters: { ...state.filters, [key]: value } })),

  resetFilters: () => set({ filters: { ...DEFAULT_FILTERS } }),

  openCreateItem: (sprint_id) =>
    set({ dialog: { kind: "create_item", sprint_id } }),

  openCreateSprint: () => set({ dialog: { kind: "create_sprint" } }),

  openAssignSprint: (workItemId) =>
    set({ dialog: { kind: "assign_sprint", workItemId } }),

  closeDialog: () => set({ dialog: { kind: "closed" } }),

  toggleSprintCollapse: (sprintId) =>
    set((state) => ({
      collapsedSprints: {
        ...state.collapsedSprints,
        [sprintId]: !state.collapsedSprints[sprintId],
      },
    })),

  toggleBacklogCollapse: () =>
    set((state) => ({ backlogCollapsed: !state.backlogCollapsed })),
}));
