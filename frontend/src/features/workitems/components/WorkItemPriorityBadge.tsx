"use client";

import { cn } from "@/lib/utils";
import { Flag } from "lucide-react";
import type { Priority } from "@/types";

interface WorkItemPriorityBadgeProps {
  priority: Priority;
  className?: string;
  showLabel?: boolean;
}

export const PRIORITY_CONFIG: Record<
  Priority,
  { label: string; className: string }
> = {
  critical: {
    label: "Critical",
    className: "text-red-600 dark:text-red-400",
  },
  high: {
    label: "High",
    className: "text-orange-600 dark:text-orange-400",
  },
  medium: {
    label: "Medium",
    className: "text-yellow-600 dark:text-yellow-500",
  },
  low: {
    label: "Low",
    className: "text-blue-600 dark:text-blue-400",
  },
};

export function WorkItemPriorityBadge({
  priority,
  className,
  showLabel = true,
}: WorkItemPriorityBadgeProps) {
  const cfg = PRIORITY_CONFIG[priority];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-medium text-sm",
        cfg.className,
        className,
      )}
    >
      <Flag className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {showLabel && cfg.label}
    </span>
  );
}
