"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { WorkItemStatus } from "@/types";

interface WorkItemStatusBadgeProps {
  status: WorkItemStatus;
  className?: string;
}

const STATUS_CONFIG: Record<WorkItemStatus, { label: string; className: string }> = {
  backlog: {
    label: "Backlog",
    className:
      "border-transparent bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  },
  todo: {
    label: "To Do",
    className:
      "border-transparent bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  },
  in_progress: {
    label: "In Progress",
    className:
      "border-transparent bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  },
  review: {
    label: "In Review",
    className:
      "border-transparent bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  },
  done: {
    label: "Done",
    className:
      "border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
};

export function WorkItemStatusBadge({ status, className }: WorkItemStatusBadgeProps) {
  const { label, className: statusClass } = STATUS_CONFIG[status];
  return (
    <Badge className={cn(statusClass, "select-none", className)}>
      {label}
    </Badge>
  );
}

export { STATUS_CONFIG };
