// ─── Public API of the board feature ──────────────────────────────────────────

// Main board component
export { SprintBoard } from "./components/SprintBoard";

// Sub-components (exported for potential reuse)
export { BoardCard } from "./components/BoardCard";
export { BoardColumn } from "./components/BoardColumn";
export { SprintBoardDnd } from "./components/SprintBoardDnd";
export { WorkItemDetailSheet } from "./components/WorkItemDetailSheet";

// Hooks
export {
  useActiveSprint,
  useSprintBoard,
  useMoveItem,
  useCreateBoardItem,
  boardKeys,
  BOARD_COLUMNS,
} from "./hooks/useSprintBoard";

// Store
export { useBoardStore } from "./store";
export type { BoardColumn as BoardColumnData } from "./store";
