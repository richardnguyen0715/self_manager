// ─── Public feature barrel ─────────────────────────────────────────────────────

// Components
export { TaskList } from "./components/TaskList";
export { TaskDialog } from "./components/TaskDialog";
export { TaskRow } from "./components/TaskRow";
export { TaskFilters } from "./components/TaskFilters";
export { SubtaskList } from "./components/SubtaskList";
export { PriorityBadge } from "./components/PriorityBadge";
export { StatusBadge } from "./components/StatusBadge";

// Hooks
export {
  useTasks,
  useTask,
  useSubtasks,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  useToggleTaskComplete,
  useCreateSubtask,
  useUpdateSubtask,
  useDeleteSubtask,
  taskKeys,
} from "./hooks/useTasks";
export { useProjects, projectKeys } from "./hooks/useProjects";
export { useTags, useAddTagToTask, useRemoveTagFromTask, tagKeys } from "./hooks/useTags";

// Store
export { useTaskUIStore } from "./store";

// Types
export type {
  CreateTaskPayload,
  UpdateTaskPayload,
  CreateSubtaskPayload,
  UpdateSubtaskPayload,
  TaskFiltersState,
  TaskFilterKey,
} from "./types";
