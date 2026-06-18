// ─── Public feature barrel ─────────────────────────────────────────────────────

// Hooks — Work Items
export {
  useWorkItems,
  useWorkItem,
  useWorkItemSubtasks,
  useBacklog,
  useCreateWorkItem,
  useUpdateWorkItem,
  useDeleteWorkItem,
  useSetWorkItemStatus,
  useSetWorkItemPoints,
  useMoveWorkItemToSprint,
  useMoveWorkItemToBacklog,
  useCreateWorkItemSubtask,
  useUpdateWorkItemSubtask,
  useDeleteWorkItemSubtask,
  workItemKeys,
} from "./hooks/useWorkItems";

// Hooks — Sprints
export {
  useSprints,
  useSprint,
  useActiveSprint,
  useSprintWorkItems,
  useSprintBurndown,
  useSprintReview,
  useSprintRetro,
  useSprintVelocity,
  useCreateSprint,
  useUpdateSprint,
  useDeleteSprint,
  useActivateSprint,
  useCompleteSprint,
  useUpsertSprintReview,
  useUpsertRetrospective,
  sprintKeys,
} from "./hooks/useSprints";

// Hooks — Epics
export {
  useEpics,
  useEpic,
  useEpicWorkItems,
  useCreateEpic,
  useUpdateEpic,
  useDeleteEpic,
  epicKeys,
} from "./hooks/useEpics";

// Hooks — Initiatives
export {
  useInitiatives,
  useInitiative,
  useInitiativeEpics,
  useCreateInitiative,
  useUpdateInitiative,
  useDeleteInitiative,
  initiativeKeys,
} from "./hooks/useInitiatives";

// Components
export { WorkItemStatusBadge } from "./components/WorkItemStatusBadge";
export { WorkItemTypeBadge } from "./components/WorkItemTypeBadge";

// Types
export type {
  CreateWorkItemPayload,
  UpdateWorkItemPayload,
  SetWorkItemStatusPayload,
  SetWorkItemPointsPayload,
  MoveWorkItemToSprintPayload,
  MoveWorkItemToBacklogPayload,
  CreateWorkItemSubtaskPayload,
  UpdateWorkItemSubtaskPayload,
  CreateSprintPayload,
  UpdateSprintPayload,
  CompleteSprintPayload,
  UpsertSprintReviewPayload,
  UpsertRetrospectivePayload,
  CreateEpicPayload,
  UpdateEpicPayload,
  CreateInitiativePayload,
  UpdateInitiativePayload,
  WorkItemFiltersState,
} from "./types";
