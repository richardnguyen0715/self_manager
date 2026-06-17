import type { Priority, TaskStatus, HabitType, ProjectStatus, HabitFrequency } from "@/types";

// ─── Search result entity kinds (backend only supports these three) ────────────

export type SearchResultKind = "task" | "project" | "habit";

// ─── Per-kind hit shapes returned by /api/search ─────────────────────────────
// These mirror TaskHit / ProjectHit / HabitHit from @/types exactly.

export interface SearchResultTask {
  kind: "task";
  id: string;
  title: string;
  description: string | null;
  priority: Priority;
  status: TaskStatus;
  due_date: string | null;
  project_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SearchResultProject {
  kind: "project";
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  deadline: string | null;
  goal_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SearchResultHabit {
  kind: "habit";
  id: string;
  name: string;
  description: string | null;
  habit_type: HabitType;
  frequency: HabitFrequency;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export type SearchResult =
  | SearchResultTask
  | SearchResultProject
  | SearchResultHabit;

// ─── API request / response ───────────────────────────────────────────────────
// Matches backend SearchResponse { query, total, tasks?, projects?, habits? }

export interface SearchParams {
  q: string;
  kinds?: SearchResultKind[];
  limit?: number;
}

export interface SearchResponse {
  query: string;
  total: number;
  tasks?: SearchResultTask[];
  projects?: SearchResultProject[];
  habits?: SearchResultHabit[];
}

// ─── Command palette action kinds ─────────────────────────────────────────────

export type CommandAction =
  | { type: "navigate"; label: string; href: string; icon: string }
  | { type: "create_task"; label: string }
  | { type: "create_habit"; label: string }
  | { type: "search"; label: string; query: string };

// ─── Quick-create payloads ────────────────────────────────────────────────────

export interface QuickCreateTaskPayload {
  title: string;
  priority?: Priority;
  status?: TaskStatus;
}

export interface QuickCreateHabitPayload {
  // `name` matches backend CreateHabitRequest
  name: string;
  habit_type?: HabitType;
  frequency?: HabitFrequency;
}

// ─── Store shape ──────────────────────────────────────────────────────────────

export interface SearchStoreState {
  // Command palette
  isOpen: boolean;
  inputValue: string;
  selectedKinds: SearchResultKind[];

  // Full-page search
  pageQuery: string;
  pageKinds: SearchResultKind[];
  pageLimit: number;

  // Quick-create inline state
  quickCreateMode: "task" | "habit" | null;

  // Actions
  open: () => void;
  close: () => void;
  setInputValue: (v: string) => void;
  toggleKind: (k: SearchResultKind) => void;
  setSelectedKinds: (ks: SearchResultKind[]) => void;
  setPageQuery: (q: string) => void;
  setPageKinds: (ks: SearchResultKind[]) => void;
  setPageLimit: (n: number) => void;
  setQuickCreateMode: (mode: "task" | "habit" | null) => void;
  reset: () => void;
}
