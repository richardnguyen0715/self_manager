"use client";

import { useState } from "react";
import Link from "next/link";
import { format, isPast, isToday } from "date-fns";
import {
  CheckCircle2,
  Circle,
  Clock,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DashboardTask, Priority } from "@/types";
import { useCompleteTask } from "../hooks/useCompleteTask";
import { useDashboardUIStore } from "../store";

const PRIORITY_BADGE: Record<Priority, React.ComponentProps<typeof Badge>["variant"]> = {
  critical: "critical",
  high: "high",
  medium: "medium",
  low: "low",
};

function dueDateLabel(dueDate: string): { text: string; urgent: boolean } {
  const date = new Date(dueDate);
  if (isPast(date) && !isToday(date)) {
    return { text: `Overdue · ${format(date, "MMM d")}`, urgent: true };
  }
  if (isToday(date)) {
    return { text: "Due today", urgent: false };
  }
  return { text: `Due ${format(date, "MMM d")}`, urgent: false };
}

interface TodayTaskItemProps {
  task: DashboardTask;
}

export function TodayTaskItem({ task }: TodayTaskItemProps) {
  const { mutate: completeTask } = useCompleteTask();
  const { pendingTaskIds } = useDashboardUIStore();
  const isPending = pendingTaskIds.has(task.id);
  const isCompleted = task.status === "completed";
  const [hovered, setHovered] = useState(false);

  const handleComplete = () => {
    if (isCompleted || isPending) return;
    completeTask({ task_id: task.id });
  };

  const dueInfo = task.due_date ? dueDateLabel(task.due_date) : null;

  return (
    <div
      className={cn(
        "group flex items-start gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-accent/50",
        isCompleted && "opacity-50",
      )}
    >
      {/* Complete toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="mt-0.5 h-5 w-5 shrink-0 p-0 text-muted-foreground hover:text-foreground"
        onClick={handleComplete}
        disabled={isCompleted || isPending}
        aria-label={isCompleted ? "Task completed" : "Mark task complete"}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isCompleted || hovered ? (
          <CheckCircle2
            className={cn(
              "h-4 w-4",
              isCompleted ? "text-emerald-500" : "text-muted-foreground",
            )}
          />
        ) : (
          <Circle className="h-4 w-4" />
        )}
      </Button>

      {/* Task content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p
            className={cn(
              "text-sm leading-snug text-foreground",
              isCompleted && "line-through",
            )}
          >
            {task.title}
          </p>
          {/* Link to tasks with this task highlighted */}
          <Link
            href={`/work-items?id=${task.id}`}
            className="invisible shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:visible group-hover:opacity-100"
            aria-label="Open task details"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Meta row */}
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <Badge variant={PRIORITY_BADGE[task.priority]} className="h-4 text-[10px]">
            {task.priority}
          </Badge>

          {dueInfo && (
            <span
              className={cn(
                "flex items-center gap-1 text-[11px]",
                dueInfo.urgent
                  ? "text-destructive"
                  : "text-muted-foreground",
              )}
            >
              <Clock className="h-3 w-3" />
              {dueInfo.text}
            </span>
          )}

          {task.project_name && (
            <span className="text-[11px] text-muted-foreground">
              {task.project_name}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
