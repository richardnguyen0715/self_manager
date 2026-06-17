import { create } from "zustand";
import type { GoalStatus } from "@/types";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface GoalsUIState {
  // Filter state
  statusFilter: GoalStatus | "all";

  // Expansion state: goalId -> boolean (tree nodes)
  expandedGoals: Record<string, boolean>;
  // projectId -> boolean (whether project tasks are shown)
  expandedProjects: Record<string, boolean>;

  // Dialog/modal state
  createGoalOpen: boolean;
  editGoalId: string | null;
  deleteGoalId: string | null;
  createProjectForGoalId: string | null;

  // Search within goals list
  searchQuery: string;

  // Actions
  setStatusFilter: (status: GoalStatus | "all") => void;
  toggleGoalExpanded: (goalId: string) => void;
  setGoalExpanded: (goalId: string, expanded: boolean) => void;
  toggleProjectExpanded: (projectId: string) => void;
  setProjectExpanded: (projectId: string, expanded: boolean) => void;
  openCreateGoal: () => void;
  closeCreateGoal: () => void;
  openEditGoal: (goalId: string) => void;
  closeEditGoal: () => void;
  openDeleteGoal: (goalId: string) => void;
  closeDeleteGoal: () => void;
  openCreateProject: (goalId: string) => void;
  closeCreateProject: () => void;
  setSearchQuery: (q: string) => void;
  collapseAll: () => void;
  expandAll: (goalIds: string[]) => void;
}

// ─── Store ─────────────────────────────────────────────────────────────────────

export const useGoalsStore = create<GoalsUIState>((set) => ({
  statusFilter: "all",
  expandedGoals: {},
  expandedProjects: {},
  createGoalOpen: false,
  editGoalId: null,
  deleteGoalId: null,
  createProjectForGoalId: null,
  searchQuery: "",

  setStatusFilter: (statusFilter) => set({ statusFilter }),

  toggleGoalExpanded: (goalId) =>
    set((state) => ({
      expandedGoals: {
        ...state.expandedGoals,
        [goalId]: !state.expandedGoals[goalId],
      },
    })),

  setGoalExpanded: (goalId, expanded) =>
    set((state) => ({
      expandedGoals: { ...state.expandedGoals, [goalId]: expanded },
    })),

  toggleProjectExpanded: (projectId) =>
    set((state) => ({
      expandedProjects: {
        ...state.expandedProjects,
        [projectId]: !state.expandedProjects[projectId],
      },
    })),

  setProjectExpanded: (projectId, expanded) =>
    set((state) => ({
      expandedProjects: { ...state.expandedProjects, [projectId]: expanded },
    })),

  openCreateGoal: () => set({ createGoalOpen: true }),
  closeCreateGoal: () => set({ createGoalOpen: false }),

  openEditGoal: (goalId) => set({ editGoalId: goalId }),
  closeEditGoal: () => set({ editGoalId: null }),

  openDeleteGoal: (goalId) => set({ deleteGoalId: goalId }),
  closeDeleteGoal: () => set({ deleteGoalId: null }),

  openCreateProject: (goalId) => set({ createProjectForGoalId: goalId }),
  closeCreateProject: () => set({ createProjectForGoalId: null }),

  setSearchQuery: (searchQuery) => set({ searchQuery }),

  collapseAll: () => set({ expandedGoals: {}, expandedProjects: {} }),

  expandAll: (goalIds) =>
    set({
      expandedGoals: Object.fromEntries(goalIds.map((id) => [id, true])),
    }),
}));
