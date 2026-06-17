"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { TaskStatus } from "@/types";

interface StatusBadgeProps {
  status: TaskStatus;
  className?: string;
}

const STATUS_CONFIG: Record<
  TaskStatus,
  { label: string; className: string }
> = {
  inbox: {
    label: "Inbox",
    className:
      "border-transparent bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  },
  planned: {
    label: "Planned",
    className:
      "border-transparent bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  },
  in_progress: {
    label: "In Progress",
    className:
      "border-transparent bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  },
  waiting: {
    label: "Waiting",
    className:
      "border-transparent bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  },
  completed: {
    label: "Completed",
    className:
      "border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  archived: {
    label: "Archived",
    className:
      "border-transparent bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400",
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const { label, className: statusClass } = STATUS_CONFIG[status];
  return (
    <Badge className={cn(statusClass, "select-none", className)}>
      {label}
    </Badge>
  );
}
