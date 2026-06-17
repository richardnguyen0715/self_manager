"use client";

import { Clock, CheckSquare, Calendar, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NotificationType } from "@/types";

interface NotificationIconProps {
  type: NotificationType;
  className?: string;
}

const TYPE_META: Record<
  NotificationType,
  { Icon: React.ElementType; containerClass: string; iconClass: string }
> = {
  deadline_1d: {
    Icon: CheckSquare,
    containerClass: "bg-orange-100 dark:bg-orange-900/30",
    iconClass: "text-orange-600 dark:text-orange-400",
  },
  deadline_2h: {
    Icon: CheckSquare,
    containerClass: "bg-orange-100 dark:bg-orange-900/30",
    iconClass: "text-orange-600 dark:text-orange-400",
  },
  deadline_30m: {
    Icon: CheckSquare,
    containerClass: "bg-orange-100 dark:bg-orange-900/30",
    iconClass: "text-orange-600 dark:text-orange-400",
  },
  habit_reminder: {
    Icon: Calendar,
    containerClass: "bg-green-100 dark:bg-green-900/30",
    iconClass: "text-green-600 dark:text-green-400",
  },
  time_block_reminder: {
    Icon: Clock,
    containerClass: "bg-blue-100 dark:bg-blue-900/30",
    iconClass: "text-blue-600 dark:text-blue-400",
  },
  goal_deadline: {
    Icon: CheckSquare,
    containerClass: "bg-orange-100 dark:bg-orange-900/30",
    iconClass: "text-orange-600 dark:text-orange-400",
  },
  system: {
    Icon: Bell,
    containerClass: "bg-muted",
    iconClass: "text-muted-foreground",
  },
};

export function NotificationIcon({ type, className }: NotificationIconProps) {
  const { Icon, containerClass, iconClass } =
    TYPE_META[type] ?? TYPE_META.system;

  return (
    <span
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
        containerClass,
        className,
      )}
      aria-hidden
    >
      <Icon className={cn("h-4 w-4", iconClass)} />
    </span>
  );
}
