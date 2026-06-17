"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  CalendarDays,
  Clock,
  Flag,
  GripVertical,
  CheckSquare,
} from "lucide-react";
import { format, isPast, isToday, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { Task, Priority, TaskStatus } from "@/types";
import { useKanbanStore } from "../store";

// ─── Priority helpers ─────────────────────────────────────────────────────────

const PRIORITY_COLORS: Record<Priority, string> = {
  critical: "text-red-500",
  high: "text-orange-500",
  medium: "text-yellow-500",
  low: "text-blue-500",
};

const PRIORITY_BADGE_VARIANT: Record<
  Priority,
  "critical" | "high" | "medium" | "low"
> = {
  critical: "critical",
  high: "high",
  medium: "medium",
  low: "low",
};

// ─── Component ────────────────────────────────────────────────────────────────

interface KanbanCardProps {
  task: Task;
  columnId: TaskStatus;
  /** When true the card renders as a static placeholder (overlay clone) */
  isOverlay?: boolean;
}

export function KanbanCard({ task, columnId, isOverlay = false }: KanbanCardProps) {
  const openCardDetail = useKanbanStore((s) => s.openCardDetail);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: { type: "card", taskId: task.id, columnId },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Due date formatting
  const dueDateLabel = task.due_date
    ? isToday(parseISO(task.due_date))
      ? "Today"
      : format(parseISO(task.due_date), "MMM d")
    : null;

  const isOverdue =
    task.due_date &&
    isPast(parseISO(task.due_date)) &&
    task.status !== "completed";

  const completedSubtasks = task.subtasks.filter((s) => s.is_done).length;
  const totalSubtasks = task.subtasks.length;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative rounded-lg border bg-card text-card-foreground shadow-sm",
        "transition-shadow duration-150",
        isDragging && "opacity-40 shadow-none",
        isOverlay && "rotate-1 shadow-xl ring-2 ring-primary/30",
        !isDragging && !isOverlay && "hover:shadow-md cursor-pointer",
      )}
      onClick={() => !isDragging && openCardDetail(task.id)}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className={cn(
          "absolute left-2 top-1/2 -translate-y-1/2 p-0.5 rounded",
          "text-muted-foreground/30 hover:text-muted-foreground/70",
          "opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing",
          "focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        )}
        onClick={(e) => e.stopPropagation()}
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>

      <div className="px-3 py-2.5 pl-7 space-y-2">
        {/* Tags row */}
        {task.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {task.tags.slice(0, 3).map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center rounded-full px-1.5 py-0 text-[10px] font-medium"
                style={{
                  backgroundColor: tag.color ? tag.color + "22" : undefined,
                  color: tag.color ?? undefined,
                }}
              >
                {tag.name}
              </span>
            ))}
            {task.tags.length > 3 && (
              <span className="inline-flex items-center rounded-full px-1.5 py-0 text-[10px] font-medium bg-muted text-muted-foreground">
                +{task.tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Title */}
        <p
          className={cn(
            "text-sm font-medium leading-snug line-clamp-2",
            task.status === "completed" && "line-through text-muted-foreground",
          )}
        >
          {task.title}
        </p>

        {/* Description preview */}
        {task.description && (
          <p className="text-xs text-muted-foreground line-clamp-1">
            {task.description}
          </p>
        )}

        {/* Footer row */}
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-2">
            {/* Priority */}
            <Flag
              className={cn("h-3 w-3", PRIORITY_COLORS[task.priority])}
              aria-label={`Priority: ${task.priority}`}
            />

            {/* Due date */}
            {dueDateLabel && (
              <span
                className={cn(
                  "flex items-center gap-0.5 text-[11px]",
                  isOverdue
                    ? "text-destructive font-medium"
                    : "text-muted-foreground",
                )}
              >
                <CalendarDays className="h-3 w-3" />
                {dueDateLabel}
              </span>
            )}

            {/* Estimated time */}
            {task.estimated_time && (
              <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
                <Clock className="h-3 w-3" />
                {task.estimated_time >= 60
                  ? `${Math.round(task.estimated_time / 60)}h`
                  : `${task.estimated_time}m`}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {/* Subtasks */}
            {totalSubtasks > 0 && (
              <span
                className={cn(
                  "flex items-center gap-0.5 text-[11px]",
                  completedSubtasks === totalSubtasks
                    ? "text-green-600"
                    : "text-muted-foreground",
                )}
              >
                <CheckSquare className="h-3 w-3" />
                {completedSubtasks}/{totalSubtasks}
              </span>
            )}

            {/* Priority badge — only for critical */}
            {task.priority === "critical" && (
              <Badge
                variant={PRIORITY_BADGE_VARIANT[task.priority]}
                className="h-4 px-1 text-[10px]"
              >
                !
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
