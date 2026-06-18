"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SprintStatus } from "@/types";

interface SprintStatusBadgeProps {
  status: SprintStatus;
  className?: string;
}

export const SPRINT_STATUS_CONFIG: Record<
  SprintStatus,
  { label: string; className: string }
> = {
  active: {
    label: "Active",
    className:
      "border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  planned: {
    label: "Planned",
    className:
      "border-transparent bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  },
  completed: {
    label: "Completed",
    className:
      "border-transparent bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  },
};

export function SprintStatusBadge({ status, className }: SprintStatusBadgeProps) {
  const { label, className: statusClass } = SPRINT_STATUS_CONFIG[status];
  return (
    <Badge className={cn(statusClass, "select-none text-xs", className)}>
      {label}
    </Badge>
  );
}
