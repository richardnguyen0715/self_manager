"use client";

import {
  BookOpen,
  CheckSquare,
  Bug,
  Repeat2,
  Flag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { WorkItemType } from "@/types";

const TYPE_CONFIG: Record<
  WorkItemType,
  { label: string; icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  story: {
    label: "Story",
    icon: BookOpen,
    color: "text-violet-600 bg-violet-100 dark:bg-violet-900/30 dark:text-violet-400",
  },
  task: {
    label: "Task",
    icon: CheckSquare,
    color: "text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400",
  },
  bug: {
    label: "Bug",
    icon: Bug,
    color: "text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400",
  },
  habit: {
    label: "Habit",
    icon: Repeat2,
    color:
      "text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400",
  },
  milestone: {
    label: "Milestone",
    icon: Flag,
    color:
      "text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400",
  },
};

interface WorkItemTypeBadgeProps {
  type: WorkItemType;
  showLabel?: boolean;
  className?: string;
}

export function WorkItemTypeBadge({
  type,
  showLabel = false,
  className,
}: WorkItemTypeBadgeProps) {
  const config = TYPE_CONFIG[type] ?? TYPE_CONFIG.task;
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium",
        config.color,
        className,
      )}
      title={config.label}
    >
      <Icon className="h-3 w-3 shrink-0" />
      {showLabel && <span>{config.label}</span>}
    </span>
  );
}

export function WorkItemTypeIcon({
  type,
  className,
}: {
  type: WorkItemType;
  className?: string;
}) {
  const config = TYPE_CONFIG[type] ?? TYPE_CONFIG.task;
  const Icon = config.icon;
  return (
    <span title={config.label}>
      <Icon
        className={cn("h-3.5 w-3.5 shrink-0", config.color.split(" ")[0], className)}
      />
    </span>
  );
}
