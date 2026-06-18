// ─── Public feature barrel ─────────────────────────────────────────────────────

// Components
export { WorkItemList } from "./components/WorkItemList";
export { WorkItemDetail } from "./components/WorkItemDetail";
export { WorkItemStatusBadge } from "./components/WorkItemStatusBadge";
export { WorkItemTypeBadge } from "./components/WorkItemTypeBadge";
export { WorkItemPriorityBadge } from "./components/WorkItemPriorityBadge";
export { CreateWorkItemDialog } from "./components/CreateWorkItemDialog";

// Hooks
export {
  useWorkItems,
  useWorkItem,
  useWorkItemSubtasks,
  useEpicById,
  useSprintById,
  useCreateWorkItem,
  useUpdateWorkItem,
  useDeleteWorkItem,
  useSetWorkItemStatus,
  useSetWorkItemPoints,
  useCreateWorkItemSubtask,
  useUpdateWorkItemSubtask,
  useDeleteWorkItemSubtask,
  workItemKeys,
} from "./hooks/useWorkItems";

// Store
export { useWorkItemUIStore } from "./store";

// Types
export type {
  CreateWorkItemPayload,
  UpdateWorkItemPayload,
  SetWorkItemStatusPayload,
  SetWorkItemPointsPayload,
  CreateWorkItemSubtaskPayload,
  UpdateWorkItemSubtaskPayload,
  WorkItemFiltersState,
} from "./types";
