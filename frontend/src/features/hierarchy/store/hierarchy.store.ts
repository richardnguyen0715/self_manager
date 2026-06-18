import { create } from "zustand";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface HierarchyUIState {
  // Expansion state for the tree
  expandedGoals: Record<string, boolean>;
  expandedInitiatives: Record<string, boolean>;
  expandedEpics: Record<string, boolean>;

  // Selected node for the detail panel
  selectedWorkItemId: string | null;

  // Dialog state: initiatives
  createInitiativeForGoalId: string | null;
  editInitiativeId: string | null;
  deleteInitiativeId: string | null;

  // Dialog state: epics
  createEpicForInitiativeId: string | null;
  editEpicId: string | null;
  deleteEpicId: string | null;

  // Dialog state: work items
  createWorkItemForEpicId: string | null;
  editWorkItemId: string | null;
  deleteWorkItemId: string | null;

  // Work item detail panel open
  workItemDetailOpen: boolean;

  // Actions
  toggleGoalExpanded: (goalId: string) => void;
  toggleInitiativeExpanded: (initiativeId: string) => void;
  toggleEpicExpanded: (epicId: string) => void;

  openCreateInitiative: (goalId: string) => void;
  closeCreateInitiative: () => void;
  openEditInitiative: (id: string) => void;
  closeEditInitiative: () => void;
  openDeleteInitiative: (id: string) => void;
  closeDeleteInitiative: () => void;

  openCreateEpic: (initiativeId: string) => void;
  closeCreateEpic: () => void;
  openEditEpic: (id: string) => void;
  closeEditEpic: () => void;
  openDeleteEpic: (id: string) => void;
  closeDeleteEpic: () => void;

  openCreateWorkItem: (epicId: string) => void;
  closeCreateWorkItem: () => void;
  openEditWorkItem: (id: string) => void;
  closeEditWorkItem: () => void;
  openDeleteWorkItem: (id: string) => void;
  closeDeleteWorkItem: () => void;

  openWorkItemDetail: (id: string) => void;
  closeWorkItemDetail: () => void;
}

// ─── Store ─────────────────────────────────────────────────────────────────────

export const useHierarchyStore = create<HierarchyUIState>((set) => ({
  expandedGoals: {},
  expandedInitiatives: {},
  expandedEpics: {},
  selectedWorkItemId: null,

  createInitiativeForGoalId: null,
  editInitiativeId: null,
  deleteInitiativeId: null,

  createEpicForInitiativeId: null,
  editEpicId: null,
  deleteEpicId: null,

  createWorkItemForEpicId: null,
  editWorkItemId: null,
  deleteWorkItemId: null,

  workItemDetailOpen: false,

  toggleGoalExpanded: (goalId) =>
    set((s) => ({
      expandedGoals: { ...s.expandedGoals, [goalId]: !s.expandedGoals[goalId] },
    })),

  toggleInitiativeExpanded: (initiativeId) =>
    set((s) => ({
      expandedInitiatives: {
        ...s.expandedInitiatives,
        [initiativeId]: !s.expandedInitiatives[initiativeId],
      },
    })),

  toggleEpicExpanded: (epicId) =>
    set((s) => ({
      expandedEpics: {
        ...s.expandedEpics,
        [epicId]: !s.expandedEpics[epicId],
      },
    })),

  openCreateInitiative: (goalId) =>
    set({ createInitiativeForGoalId: goalId }),
  closeCreateInitiative: () => set({ createInitiativeForGoalId: null }),

  openEditInitiative: (id) => set({ editInitiativeId: id }),
  closeEditInitiative: () => set({ editInitiativeId: null }),

  openDeleteInitiative: (id) => set({ deleteInitiativeId: id }),
  closeDeleteInitiative: () => set({ deleteInitiativeId: null }),

  openCreateEpic: (initiativeId) =>
    set({ createEpicForInitiativeId: initiativeId }),
  closeCreateEpic: () => set({ createEpicForInitiativeId: null }),

  openEditEpic: (id) => set({ editEpicId: id }),
  closeEditEpic: () => set({ editEpicId: null }),

  openDeleteEpic: (id) => set({ deleteEpicId: id }),
  closeDeleteEpic: () => set({ deleteEpicId: null }),

  openCreateWorkItem: (epicId) =>
    set({ createWorkItemForEpicId: epicId }),
  closeCreateWorkItem: () => set({ createWorkItemForEpicId: null }),

  openEditWorkItem: (id) => set({ editWorkItemId: id }),
  closeEditWorkItem: () => set({ editWorkItemId: null }),

  openDeleteWorkItem: (id) => set({ deleteWorkItemId: id }),
  closeDeleteWorkItem: () => set({ deleteWorkItemId: null }),

  openWorkItemDetail: (id) =>
    set({ selectedWorkItemId: id, workItemDetailOpen: true }),
  closeWorkItemDetail: () =>
    set({ selectedWorkItemId: null, workItemDetailOpen: false }),
}));
