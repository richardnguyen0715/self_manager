"use client";

import { cn } from "@/lib/utils";
import type { WorkItemStatus } from "@/types";

const STATUS_CONFIG: Record<
  WorkItemStatus,
  { label: string; color: string }
> = {
  backlog: {
    label: "Backlog",
    color:
      "bg-muted text-muted-foreground border-muted-foreground/30",
  },
  todo: {
    label: "To Do",
    color:
      "bg-secondary text-secondary-foreground border-secondary-foreground/20",
  },
  in_progress: {
    label: "In Progress",
    color:
      "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
  },
  review: {
    label: "Review",
    color:
      "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800",
  },
  done: {
    label: "Done",
    color:
      "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800",
  },
};

interface WorkItemStatusBadgeProps {
  status: WorkItemStatus;
  className?: string;
}

export function WorkItemStatusBadge({
  status,
  className,
}: WorkItemStatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.backlog;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold",
        config.color,
        className,
      )}
    >
      {config.label}
    </span>
  );
}

export const WORK_ITEM_STATUS_OPTIONS: { value: WorkItemStatus; label: string }[] =
  [
    { value: "backlog", label: "Backlog" },
    { value: "todo", label: "To Do" },
    { value: "in_progress", label: "In Progress" },
    { value: "review", label: "Review" },
    { value: "done", label: "Done" },
  ];
