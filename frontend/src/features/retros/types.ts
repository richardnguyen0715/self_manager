// ─── Retro system types ───────────────────────────────────────────────────────
// Mirrors design/retro-system.md (section 4 — JSON shapes, snake_case).

export type RetroKind =
  | "daily"
  | "weekly"
  | "monthly"
  | "quarterly"
  | "yearly"
  | "sprint"
  | "project"
  | "custom";

export type RetroScopeType =
  | "none"
  | "sprint"
  | "project"
  | "epic"
  | "initiative"
  | "goal"
  | "work_item"
  | "habit";

export type RetroStatus = "draft" | "completed";

export type RetroInputType =
  | "cards"
  | "text"
  | "rating"
  | "mood"
  | "checklist"
  | "auto_metrics";

export type RetroAutoSource =
  | "completed_items"
  | "habits"
  | "focus"
  | "sprint"
  | "overdue"
  | "all";

export type RetroLinkTargetType =
  | "work_item"
  | "sprint"
  | "project"
  | "epic"
  | "initiative"
  | "goal"
  | "habit"
  | "doc"
  | "retro";

export type RetroLinkRelation = "about" | "evidence" | "action_source" | "mentions";

export type RetroActionStatus = "open" | "done" | "dropped";

// ─── Templates ────────────────────────────────────────────────────────────────

export interface RetroTemplateSection {
  id: string;
  position: number;
  key: string;
  title: string;
  prompt: string | null;
  input_type: RetroInputType;
  auto_source: RetroAutoSource | null;
}

export interface RetroTemplate {
  id: string;
  /** null for built-in templates. */
  user_id: string | null;
  name: string;
  kind: RetroKind;
  description: string | null;
  is_builtin: boolean;
  sections: RetroTemplateSection[];
  created_at?: string;
  updated_at?: string;
}

/** Body of POST /api/retros/templates and the `sections` field of PATCH. */
export interface RetroTemplateSectionInput {
  key: string;
  title: string;
  prompt?: string | null;
  input_type: RetroInputType;
  auto_source?: RetroAutoSource | null;
}

export interface CreateRetroTemplatePayload {
  name: string;
  kind: RetroKind;
  description?: string | null;
  sections: RetroTemplateSectionInput[];
}

export interface UpdateRetroTemplatePayload {
  name?: string;
  description?: string | null;
  sections?: RetroTemplateSectionInput[];
}

// ─── Retros ───────────────────────────────────────────────────────────────────

export interface RetroSummary {
  id: string;
  kind: RetroKind;
  title: string;
  period_start: string; // YYYY-MM-DD
  period_end: string; // YYYY-MM-DD
  scope_type: RetroScopeType;
  scope_id: string | null;
  scope_label: string | null;
  status: RetroStatus;
  rating: number | null;
  mood: number | null;
  entries_count: number;
  links_count: number;
  open_actions: number;
  completed_at: string | null;
}

/** Frozen / live metrics for a retro. Every field is optional in practice. */
export interface RetroSnapshot {
  range?: { from?: string; to?: string };
  completed_items?: {
    count?: number;
    points?: number;
    by_type?: Record<string, number>;
    items?: { id: string; title: string; key?: string | null }[];
  };
  overdue?: { count?: number };
  habits?: {
    rate?: number | null;
    logged_days?: number;
    streaks?: { habit_id: string; name: string; streak: number }[];
  };
  focus?: { minutes?: number; sessions?: number };
  sprint?: {
    id: string;
    name: string;
    committed_points?: number;
    completed_points?: number;
    velocity?: number | null;
  } | null;
  scope?: {
    type?: string;
    id?: string;
    label?: string;
    total_items?: number;
    done_items?: number;
  } | null;
}

export interface RetroDetailHeader extends RetroSummary {
  template_id: string | null;
  summary: string | null;
  snapshot: RetroSnapshot | null;
  started_at: string;
  created_at: string;
  updated_at: string;
}

export interface RetroSection {
  id: string;
  position: number;
  key: string;
  title: string;
  prompt: string | null;
  input_type: RetroInputType;
  auto_source: RetroAutoSource | null;
}

export interface RetroEntry {
  id: string;
  section_id: string;
  position: number;
  body: string;
  rating: number | null;
  mood: number | null;
  checked: boolean;
}

export interface LinkResolved {
  id: string;
  target_type: RetroLinkTargetType;
  target_id: string;
  relation: RetroLinkRelation;
  title: string | null;
  subtitle: string | null;
  href: string | null;
}

export interface RetroAction {
  id: string;
  retro_id: string;
  text: string;
  status: RetroActionStatus;
  due_date: string | null;
  work_item_id: string | null;
  carried_from_action_id: string | null;
  carry_count: number;
  completed_at: string | null;
}

export interface RetroActionWithRetro extends RetroAction {
  retro_title: string;
  retro_kind: RetroKind;
  retro_period_start: string;
}

export interface RetroDetail {
  retro: RetroDetailHeader;
  sections: RetroSection[];
  entries: RetroEntry[];
  links: LinkResolved[];
  actions: RetroAction[];
}

export interface RetroListResponse {
  data: RetroSummary[];
  total: number;
}

export interface RetroTrendPoint {
  retro_id: string;
  period_start: string;
  title: string;
  rating: number | null;
  mood: number | null;
  completed_items: number | null;
  completed_points: number | null;
  habit_rate: number | null;
  focus_minutes: number | null;
}

// ─── Payloads ─────────────────────────────────────────────────────────────────

export interface RetroListFilters {
  kind?: RetroKind;
  scope_type?: RetroScopeType;
  scope_id?: string;
  status?: RetroStatus;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export interface OpenRetroPayload {
  kind: RetroKind;
  /** YYYY-MM-DD; defaults to today on the server. */
  date?: string;
  scope_type?: RetroScopeType;
  scope_id?: string | null;
  template_id?: string | null;
  title?: string;
}

export interface UpdateRetroPayload {
  title?: string;
  summary?: string | null;
  rating?: number | null;
  mood?: number | null;
}

export interface CreateRetroEntryPayload {
  section_id: string;
  body?: string;
  rating?: number | null;
  mood?: number | null;
  checked?: boolean;
  position?: number;
}

export interface UpdateRetroEntryPayload {
  body?: string;
  rating?: number | null;
  mood?: number | null;
  checked?: boolean;
  position?: number;
}

export interface CreateRetroLinkPayload {
  target_type: RetroLinkTargetType;
  target_id: string;
  relation?: RetroLinkRelation;
}

export interface CreateRetroActionPayload {
  text: string;
  due_date?: string | null;
}

export interface UpdateRetroActionPayload {
  text?: string;
  status?: RetroActionStatus;
  due_date?: string | null;
}

// ─── Labels (display helpers used across the feature) ─────────────────────────

export const RETRO_KIND_LABELS: Record<RetroKind, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
  sprint: "Sprint",
  project: "Project",
  custom: "Custom",
};

export const RETRO_SCOPE_LABELS: Record<RetroScopeType, string> = {
  none: "No scope",
  sprint: "Sprint",
  project: "Project",
  epic: "Epic",
  initiative: "Initiative",
  goal: "Goal",
  work_item: "Work item",
  habit: "Habit",
};

export const RETRO_LINK_TYPE_LABELS: Record<RetroLinkTargetType, string> = {
  work_item: "Work items",
  sprint: "Sprints",
  project: "Projects",
  epic: "Epics",
  initiative: "Initiatives",
  goal: "Goals",
  habit: "Habits",
  doc: "Docs",
  retro: "Retros",
};

export const RETRO_LINK_RELATION_LABELS: Record<RetroLinkRelation, string> = {
  about: "About",
  evidence: "Evidence",
  action_source: "Action source",
  mentions: "Mentions",
};
