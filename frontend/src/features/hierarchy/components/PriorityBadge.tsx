"use client";

import { cn } from "@/lib/utils";
import type { Priority } from "@/types";

const PRIORITY_CONFIG: Record<
  Priority,
  { label: string; dot: string; text: string }
> = {
  critical: {
    label: "Critical",
    dot: "bg-red-500",
    text: "text-red-600 dark:text-red-400",
  },
  high: {
    label: "High",
    dot: "bg-orange-500",
    text: "text-orange-600 dark:text-orange-400",
  },
  medium: {
    label: "Medium",
    dot: "bg-yellow-500",
    text: "text-yellow-600 dark:text-yellow-400",
  },
  low: {
    label: "Low",
    dot: "bg-blue-400",
    text: "text-blue-500 dark:text-blue-400",
  },
};

interface PriorityBadgeProps {
  priority: Priority;
  showLabel?: boolean;
  className?: string;
}

export function PriorityBadge({
  priority,
  showLabel = true,
  className,
}: PriorityBadgeProps) {
  const config = PRIORITY_CONFIG[priority] ?? PRIORITY_CONFIG.medium;
  return (
    <span
      className={cn("inline-flex items-center gap-1.5", className)}
      title={`Priority: ${config.label}`}
    >
      <span className={cn("h-2 w-2 rounded-full shrink-0", config.dot)} />
      {showLabel && (
        <span className={cn("text-xs font-medium", config.text)}>
          {config.label}
        </span>
      )}
    </span>
  );
}
