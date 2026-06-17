"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Priority } from "@/types";

interface PriorityBadgeProps {
  priority: Priority;
  className?: string;
}

const PRIORITY_LABEL: Record<Priority, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

const PRIORITY_DOT: Record<Priority, string> = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-blue-500",
};

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  return (
    <Badge
      variant={priority}
      className={cn("gap-1.5 select-none", className)}
    >
      <span
        className={cn("h-1.5 w-1.5 rounded-full", PRIORITY_DOT[priority])}
        aria-hidden="true"
      />
      {PRIORITY_LABEL[priority]}
    </Badge>
  );
}
