// ─── Public API of the board feature ──────────────────────────────────────────

// Main board component
export { SprintBoard } from "./components/SprintBoard";

// Sub-components (exported for potential reuse)
export { BoardCard } from "./components/BoardCard";
export { BoardColumn } from "./components/BoardColumn";
export { SprintBoardDnd } from "./components/SprintBoardDnd";
export { WorkItemDetailSheet } from "./components/WorkItemDetailSheet";
export { AddColumnDialog } from "./components/AddColumnDialog";

// Hooks
export {
  useActiveSprint,
  useSprintBoard,
  useMoveItem,
  useMoveItemToColumn,
  useCreateBoardItem,
  useBoardColumns,
  useCreateColumn,
  useUpdateColumn,
  useDeleteColumn,
  useReorderColumns,
  boardKeys,
  BOARD_COLUMNS,
} from "./hooks/useSprintBoard";

// Store
export { useBoardStore } from "./store";
export type { BoardColumn as BoardColumnState } from "./store";
