// ─── Feature public API ────────────────────────────────────────────────────────

// Components
export { CommandPalette } from "./components/CommandPalette";
export { SearchPage } from "./components/SearchPage";
export { SearchResultItem } from "./components/SearchResultItem";

// Hooks
export { useSearchQuery, useSearchByKind, searchKeys } from "./hooks/useSearch";
export { useQuickCreateTask, useQuickCreateHabit } from "./hooks/useQuickCreate";

// Store
export { useSearchStore } from "./store";

// Types
export type {
  SearchResult,
  SearchResultKind,
  SearchResultTask,
  SearchResultProject,
  SearchResultHabit,
  SearchParams,
  SearchResponse,
  QuickCreateTaskPayload,
  QuickCreateHabitPayload,
  SearchStoreState,
} from "./types";
