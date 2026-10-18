// ─── Label (managed, coloured) ────────────────────────────────────────────────

/** Row returned by GET /api/labels. */
export interface Label {
  id: string;
  user_id: string;
  /** null = global to the user; set = scoped to one project. */
  project_id: string | null;
  name: string;
  color: string;
  created_at: string;
}

export interface CreateLabelPayload {
  name: string;
  color?: string;
  project_id?: string | null;
}

export interface UpdateLabelPayload {
  name?: string;
  color?: string;
}

/** Fallback colour for names that exist on work items but have no label row. */
export const DEFAULT_LABEL_COLOR = "#64748b";

/** Preset swatches offered when creating or recolouring a label. */
export const LABEL_COLOR_PRESETS: readonly string[] = [
  "#ef4444", // red
  "#f97316", // orange
  "#f59e0b", // amber
  "#22c55e", // green
  "#14b8a6", // teal
  "#3b82f6", // blue
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#64748b", // slate
];
