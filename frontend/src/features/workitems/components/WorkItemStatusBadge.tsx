"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { WorkItemStatus } from "@/types";

interface WorkItemStatusBadgeProps {
  status: WorkItemStatus;
  className?: string;
}

export const WORK_ITEM_STATUS_CONFIG: Record<
  WorkItemStatus,
  { label: string; dotClass: string; badgeClass: string }
> = {
  backlog: {
    label: "Backlog",
    dotClass: "bg-slate-400",
    badgeClass:
      "border-transparent bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  },
  todo: {
    label: "To Do",
    dotClass: "bg-violet-500",
    badgeClass:
      "border-transparent bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  },
  in_progress: {
    label: "In Progress",
    dotClass: "bg-sky-500",
    badgeClass:
      "border-transparent bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  },
  review: {
    label: "In Review",
    dotClass: "bg-amber-500",
    badgeClass:
      "border-transparent bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  },
  done: {
    label: "Done",
    dotClass: "bg-emerald-500",
    badgeClass:
      "border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
};

export function WorkItemStatusBadge({
  status,
  className,
}: WorkItemStatusBadgeProps) {
  const cfg = WORK_ITEM_STATUS_CONFIG[status];
  return (
    <Badge className={cn(cfg.badgeClass, "select-none gap-1.5", className)}>
      <span
        className={cn("h-1.5 w-1.5 rounded-full shrink-0", cfg.dotClass)}
        aria-hidden="true"
      />
      {cfg.label}
    </Badge>
  );
}
