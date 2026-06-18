// ─── Backlog feature public barrel ─────────────────────────────────────────────

// Main screen entry point
export { BacklogScreen } from "./components/BacklogScreen";

// Sub-components (exported for possible reuse)
export { BacklogFilterBar } from "./components/BacklogFilterBar";
export { SprintSection } from "./components/SprintSection";
export { BacklogSection } from "./components/BacklogSection";
export { WorkItemRow } from "./components/WorkItemRow";
export { QuickAddRow } from "./components/QuickAddRow";
export { CreateWorkItemDialog } from "./components/CreateWorkItemDialog";
export { CreateSprintDialog } from "./components/CreateSprintDialog";

// Store
export { useBacklogStore } from "./store/useBacklogStore";
export type { BacklogFiltersState, BacklogDialogMode } from "./store/useBacklogStore";
