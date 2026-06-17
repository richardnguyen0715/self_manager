// ─── Feature public API ────────────────────────────────────────────────────────

// Components
export { HabitList } from "./components/HabitList";
export { HabitCard } from "./components/HabitCard";
export { HabitFormDialog } from "./components/HabitFormDialog";
export { HabitLogDialog } from "./components/HabitLogDialog";
export { HabitHeatmapDialog, HeatmapGrid } from "./components/HabitHeatmap";

// Hooks
export {
  habitKeys,
  useHabits,
  useHabit,
  useHabitLogs,
  useCreateHabit,
  useUpdateHabit,
  useArchiveHabit,
  useDeleteHabit,
  useLogHabit,
  useDeleteHabitLog,
  todayISODate,
} from "./hooks/useHabits";
export type {
  HabitListFilters,
  CreateHabitPayload,
  UpdateHabitPayload,
  LogHabitPayload,
} from "./hooks/useHabits";

// Store
export { useHabitsStore } from "./store/habits.store";
