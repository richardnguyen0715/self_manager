// ─── Main view ─────────────────────────────────────────────────────────────────
export { HierarchyView } from "./components/HierarchyView";

// ─── Sub-components ───────────────────────────────────────────────────────────
export { GoalHierarchyRow } from "./components/GoalHierarchyRow";
export { InitiativeRow } from "./components/InitiativeRow";
export { EpicRow } from "./components/EpicRow";
export { WorkItemDetail } from "./components/WorkItemDetail";
export { WorkItemTypeBadge } from "./components/WorkItemTypeBadge";
export { WorkItemStatusBadge } from "./components/WorkItemStatusBadge";
export { PriorityBadge } from "./components/PriorityBadge";
export { InitiativeForm } from "./components/InitiativeForm";
export { EpicForm } from "./components/EpicForm";
export { WorkItemForm } from "./components/WorkItemForm";
export { DeleteConfirmDialog } from "./components/DeleteConfirmDialog";

// ─── Hooks ─────────────────────────────────────────────────────────────────────
export {
  hierarchyKeys,
  useGoalsList,
  useInitiatives,
  useInitiative,
  useInitiativeEpics,
  useCreateInitiative,
  useUpdateInitiative,
  useDeleteInitiative,
  useEpics,
  useEpic,
  useEpicWorkItems,
  useCreateEpic,
  useUpdateEpic,
  useDeleteEpic,
  useWorkItems,
  useWorkItem,
  useWorkItemSubtasks,
  useCreateWorkItem,
  useUpdateWorkItem,
  useSetWorkItemStatus,
  useDeleteWorkItem,
  useCreateWorkItemSubtask,
  useUpdateWorkItemSubtask,
  useDeleteWorkItemSubtask,
} from "./hooks/useHierarchy";
export type {
  GoalListParams,
  InitiativeListParams,
  EpicListParams,
  WorkItemListParams,
  CreateInitiativePayload,
  UpdateInitiativePayload,
  CreateEpicPayload,
  UpdateEpicPayload,
  CreateWorkItemPayload,
  UpdateWorkItemPayload,
  CreateSubtaskPayload,
  UpdateSubtaskPayload,
} from "./hooks/useHierarchy";

// ─── Store ─────────────────────────────────────────────────────────────────────
export { useHierarchyStore } from "./store/hierarchy.store";
