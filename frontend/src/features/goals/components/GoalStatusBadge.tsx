import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { GoalStatus } from "@/types";

interface GoalStatusBadgeProps {
  status: GoalStatus;
  className?: string;
}

const STATUS_CONFIG: Record<
  GoalStatus,
  { label: string; className: string }
> = {
  active: {
    label: "Active",
    className:
      "border-transparent bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  },
  paused: {
    label: "Paused",
    className:
      "border-transparent bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  },
  completed: {
    label: "Completed",
    className:
      "border-transparent bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  abandoned: {
    label: "Abandoned",
    className:
      "border-transparent bg-secondary text-muted-foreground",
  },
};

export function GoalStatusBadge({ status, className }: GoalStatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  return (
    <Badge className={cn(config.className, className)}>
      {config.label}
    </Badge>
  );
}
