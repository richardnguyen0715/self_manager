// ─── Public API of the kanban feature ────────────────────────────────────────

export { KanbanBoard } from "./components/KanbanBoard";
export { KanbanColumn } from "./components/KanbanColumn";
export { KanbanCard } from "./components/KanbanCard";
export { CardDetailDialog } from "./components/CardDetailDialog";
export { AddCardDialog } from "./components/AddCardDialog";

export { useKanbanColumns } from "./hooks/useKanbanColumns";
export { useMoveCard } from "./hooks/useKanbanMutations";
export {
  useCreateCard,
  useUpdateCard,
  useDeleteCard,
} from "./hooks/useTaskMutations";

export { useKanbanStore } from "./store";
export { DEFAULT_COLUMNS } from "./types";
export type {
  KanbanColumn as KanbanColumnData,
  CreateCardPayload,
  UpdateCardPayload,
  DragItem,
} from "./types";
