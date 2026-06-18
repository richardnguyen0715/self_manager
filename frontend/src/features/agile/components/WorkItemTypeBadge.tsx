"use client";

import { cn } from "@/lib/utils";
import {
  BookOpen,
  CheckSquare,
  Bug,
  Repeat2,
  Milestone,
} from "lucide-react";
import type { WorkItemType } from "@/types";

interface WorkItemTypeBadgeProps {
  type: WorkItemType;
  className?: string;
  showLabel?: boolean;
}

const TYPE_CONFIG: Record<
  WorkItemType,
  { label: string; icon: React.ComponentType<{ className?: string }>; className: string }
> = {
  story: {
    label: "Story",
    icon: BookOpen,
    className: "text-emerald-600 dark:text-emerald-400",
  },
  task: {
    label: "Task",
    icon: CheckSquare,
    className: "text-sky-600 dark:text-sky-400",
  },
  bug: {
    label: "Bug",
    icon: Bug,
    className: "text-red-600 dark:text-red-400",
  },
  habit: {
    label: "Habit",
    icon: Repeat2,
    className: "text-violet-600 dark:text-violet-400",
  },
  milestone: {
    label: "Milestone",
    icon: Milestone,
    className: "text-amber-600 dark:text-amber-400",
  },
};

export function WorkItemTypeBadge({
  type,
  className,
  showLabel = false,
}: WorkItemTypeBadgeProps) {
  const { label, icon: Icon, className: typeClass } = TYPE_CONFIG[type];
  return (
    <span className={cn("inline-flex items-center gap-1", typeClass, className)}>
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {showLabel && <span className="text-xs font-medium">{label}</span>}
    </span>
  );
}

export { TYPE_CONFIG };
