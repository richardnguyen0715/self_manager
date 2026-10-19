import type { LucideIcon } from "lucide-react";
import {
  CircleCheckBig,
  FileText,
  FolderKanban,
  Flag,
  Layers,
  Repeat,
  NotebookPen,
  Rocket,
  Target,
  Zap,
} from "lucide-react";

/** Every object type that can be the target of a mention. */
export type MentionType =
  | "work_item"
  | "doc"
  | "sprint"
  | "project"
  | "epic"
  | "initiative"
  | "goal"
  | "habit"
  | "retro";

/** Types that can contain mentions (have rich-text bodies). */
export type MentionSourceType = "work_item" | "doc" | "retro";

/** Result of GET /api/mentions/search. */
export interface MentionSearchResult {
  type: MentionType;
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

/** Result of GET /api/mentions/resolve (live title for a chip). */
export interface MentionResolved extends MentionSearchResult {
  exists: boolean;
}

/** Result of GET /api/mentions/backlinks ("Mentioned in"). */
export interface MentionBacklink {
  source_type: MentionSourceType;
  source_id: string;
  title: string;
  subtitle: string;
  href: string;
  created_at: string;
}

export interface MentionRef {
  type: MentionType;
  id: string;
}

/** Body of PUT /api/mentions/sync. */
export interface MentionSyncPayload {
  source_type: MentionSourceType;
  source_id: string;
  targets: MentionRef[];
}

/** Display order used for grouping results. */
export const MENTION_TYPES: MentionType[] = [
  "work_item",
  "doc",
  "sprint",
  "project",
  "epic",
  "initiative",
  "goal",
  "habit",
  "retro",
];

export interface MentionTypeMeta {
  label: string;
  icon: LucideIcon;
  /** Tailwind text colour class for the type icon. */
  className: string;
}

export const MENTION_TYPE_META: Record<MentionType, MentionTypeMeta> = {
  work_item: { label: "Task", icon: CircleCheckBig, className: "text-blue-600 dark:text-blue-400" },
  doc: { label: "Doc", icon: FileText, className: "text-slate-600 dark:text-slate-300" },
  sprint: { label: "Sprint", icon: Zap, className: "text-amber-600 dark:text-amber-400" },
  project: { label: "Project", icon: FolderKanban, className: "text-emerald-600 dark:text-emerald-400" },
  epic: { label: "Epic", icon: Layers, className: "text-violet-600 dark:text-violet-400" },
  initiative: { label: "Initiative", icon: Rocket, className: "text-rose-600 dark:text-rose-400" },
  goal: { label: "Goal", icon: Target, className: "text-orange-600 dark:text-orange-400" },
  habit: { label: "Habit", icon: Repeat, className: "text-teal-600 dark:text-teal-400" },
  retro: { label: "Retro", icon: NotebookPen, className: "text-fuchsia-600 dark:text-fuchsia-400" },
};

/** Filter pills in the picker. `types: undefined` means all types. */
export interface MentionFilter {
  key: string;
  label: string;
  types: MentionType[] | undefined;
}

export const MENTION_FILTERS: MentionFilter[] = [
  { key: "all", label: "All", types: undefined },
  { key: "tasks", label: "Tasks", types: ["work_item"] },
  { key: "docs", label: "Docs", types: ["doc"] },
  { key: "sprints", label: "Sprints", types: ["sprint"] },
  { key: "projects", label: "Projects", types: ["project"] },
  { key: "goals", label: "Goals", types: ["goal"] },
  { key: "other", label: "Other", types: ["epic", "initiative", "habit", "retro"] },
];

export const MENTION_TYPE_SET: ReadonlySet<string> = new Set(MENTION_TYPES);
