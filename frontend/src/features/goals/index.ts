// ─── Components ────────────────────────────────────────────────────────────────
export { GoalsView } from "./components/GoalsView";
export { GoalCard } from "./components/GoalCard";
export { GoalForm } from "./components/GoalForm";
export { ProjectForm } from "./components/ProjectForm";
export { DeleteGoalDialog } from "./components/DeleteGoalDialog";
export { GoalFilters } from "./components/GoalFilters";
export { GoalProgressBar } from "./components/GoalProgressBar";
export { GoalStatusBadge } from "./components/GoalStatusBadge";
export { GoalTreeView } from "./components/GoalTreeView";
export { GoalsEmptyState } from "./components/GoalsEmptyState";

// ─── Hooks ─────────────────────────────────────────────────────────────────────
export {
  useGoals,
  useGoal,
  useGoalProjects,
  useProjectTasks,
  useCreateGoal,
  useUpdateGoal,
  useDeleteGoal,
  useAbandonGoal,
  useCompleteGoal,
  useCreateProject,
  goalKeys,
} from "./hooks/useGoals";
export type {
  GoalListParams,
  CreateGoalPayload,
  UpdateGoalPayload,
  CreateProjectPayload,
} from "./hooks/useGoals";

// ─── Store ─────────────────────────────────────────────────────────────────────
export { useGoalsStore } from "./store/goals.store";
