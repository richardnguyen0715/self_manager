import {
  BookOpen,
  CheckSquare,
  Bug,
  Repeat2,
  Milestone,
  Layers,
  Wrench,
  Sparkles,
  FileText,
  Undo2,
  Rocket,
  Tag,
} from "lucide-react";
import type { WorkItemType } from "@/types";

/**
 * Single source of truth for work-item type presentation (label, icon, text
 * colour, and badge background). Used by every WorkItemTypeBadge so adding a
 * type only touches one place.
 */
export const WORK_ITEM_TYPE_META: Record<
  WorkItemType,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    /** Text-only colour classes. */
    text: string;
    /** Pill background + text classes. */
    badge: string;
  }
> = {
  task: { label: "Task", icon: CheckSquare, text: "text-sky-600 dark:text-sky-400", badge: "text-sky-600 bg-sky-100 dark:bg-sky-900/30 dark:text-sky-400" },
  story: { label: "Story", icon: BookOpen, text: "text-emerald-600 dark:text-emerald-400", badge: "text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400" },
  epic: { label: "Epic", icon: Layers, text: "text-purple-600 dark:text-purple-400", badge: "text-purple-600 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400" },
  feat: { label: "Feature", icon: Sparkles, text: "text-green-600 dark:text-green-400", badge: "text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400" },
  fix: { label: "Fix", icon: Wrench, text: "text-teal-600 dark:text-teal-400", badge: "text-teal-600 bg-teal-100 dark:bg-teal-900/30 dark:text-teal-400" },
  bug: { label: "Bug", icon: Bug, text: "text-red-600 dark:text-red-400", badge: "text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400" },
  debug: { label: "Debug", icon: Bug, text: "text-orange-600 dark:text-orange-400", badge: "text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400" },
  docs: { label: "Docs", icon: FileText, text: "text-blue-600 dark:text-blue-400", badge: "text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400" },
  revert: { label: "Revert", icon: Undo2, text: "text-rose-600 dark:text-rose-400", badge: "text-rose-600 bg-rose-100 dark:bg-rose-900/30 dark:text-rose-400" },
  deploy: { label: "Deploy", icon: Rocket, text: "text-indigo-600 dark:text-indigo-400", badge: "text-indigo-600 bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400" },
  release: { label: "Release", icon: Tag, text: "text-amber-600 dark:text-amber-400", badge: "text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400" },
  milestone: { label: "Milestone", icon: Milestone, text: "text-amber-600 dark:text-amber-400", badge: "text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400" },
  habit: { label: "Habit", icon: Repeat2, text: "text-violet-600 dark:text-violet-400", badge: "text-violet-600 bg-violet-100 dark:bg-violet-900/30 dark:text-violet-400" },
};
