import type { Priority, TaskStatus, Task } from "@/types";

// ─── Local KanbanColumn (no backend kanban module — derived client-side) ───────

/**
 * A virtual column that corresponds 1-to-1 with a TaskStatus value.
 * The board groups tasks by their `status` field; "columns" are never
 * persisted — they are a pure client-side concept.
 */
export interface KanbanColumn {
  /** Stable id = the TaskStatus string, e.g. "inbox" */
  id: TaskStatus;
  title: string;
  color: string | null;
  position: number;
  tasks: Task[];
}

// ─── Default column definitions ────────────────────────────────────────────────

export const DEFAULT_COLUMNS: Omit<KanbanColumn, "tasks">[] = [
  { id: "inbox",       title: "Inbox",       color: "#94a3b8", position: 0 },
  { id: "planned",     title: "Planned",     color: "#6366f1", position: 1 },
  { id: "in_progress", title: "In Progress", color: "#f97316", position: 2 },
  { id: "waiting",     title: "Waiting",     color: "#eab308", position: 3 },
  { id: "completed",   title: "Completed",   color: "#22c55e", position: 4 },
];

// ─── Task (card) payloads ─────────────────────────────────────────────────────

export interface CreateCardPayload {
  title: string;
  description?: string | null;
  priority?: Priority;
  due_date?: string | null;
  estimated_time?: number | null;
  project_id?: string | null;
  tag_ids?: string[];
}

export interface UpdateCardPayload {
  title?: string;
  description?: string | null;
  priority?: Priority;
  status?: TaskStatus;
  due_date?: string | null;
  start_date?: string | null;
  estimated_time?: number | null;
  project_id?: string | null;
  tag_ids?: string[];
}

// ─── Local DnD state ──────────────────────────────────────────────────────────

export interface DragItem {
  type: "card";
  taskId: string;
  sourceColumnId: TaskStatus;
  sourceIndex: number;
}
