"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  CalendarDays,
  Flag,
  GripVertical,
  CheckSquare,
} from "lucide-react";
import { format, isPast, isToday, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { WorkItemListItem, Priority } from "@/types";
import { WorkItemTypeBadge } from "@/features/agile/components/WorkItemTypeBadge";
import { useBoardStore } from "../store";

// ─── Priority colour helpers ──────────────────────────────────────────────────

const PRIORITY_ICON_COLORS: Record<Priority, string> = {
  critical: "text-red-500",
  high: "text-orange-500",
  medium: "text-yellow-500",
  low: "text-blue-400",
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

interface BoardCardProps {
  item: WorkItemListItem;
  /** The id of the column this card currently lives in (used for DnD data). */
  columnId: string;
  /** When true the card renders as a static drag-overlay clone */
  isOverlay?: boolean;
}

export function BoardCard({
  item,
  columnId,
  isOverlay = false,
}: BoardCardProps) {
  const openItemDetail = useBoardStore((s) => s.openItemDetail);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
    data: { type: "board-card", itemId: item.id, columnId },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // ── Due date display ─────────────────────────────────────────────────────────
  const dueDateLabel = item.due_date
    ? isToday(parseISO(item.due_date))
      ? "Today"
      : format(parseISO(item.due_date), "MMM d")
    : null;

  const isOverdue =
    item.due_date &&
    isPast(parseISO(item.due_date)) &&
    item.status !== "done";

  // ── Subtasks ─────────────────────────────────────────────────────────────────
  const subtaskCount = item.subtask_count ?? 0;
  const doneSubtaskCount = item.done_subtask_count ?? 0;
  const allSubtasksDone = subtaskCount > 0 && doneSubtaskCount === subtaskCount;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative rounded-lg border bg-card text-card-foreground shadow-sm",
        "transition-shadow duration-150",
        isDragging && "opacity-40 shadow-none ring-2 ring-primary/20",
        isOverlay && "rotate-1 shadow-xl ring-2 ring-primary/30",
        !isDragging && !isOverlay && "hover:shadow-md cursor-pointer",
      )}
      onClick={() => !isDragging && openItemDetail(item.id)}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className={cn(
          "absolute left-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded",
          "text-muted-foreground/30 hover:text-muted-foreground/70",
          "opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing",
          "focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        )}
        onClick={(e) => e.stopPropagation()}
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>

      <div className="px-3 py-2.5 pl-7 space-y-1.5">
        {/* Type tag row */}
        <div className="flex items-center gap-1.5">
          <WorkItemTypeBadge type={item.type} showLabel className="shrink-0" />
          {item.story_points != null && (
            <Badge
              variant="outline"
              className="h-4 px-1.5 text-[10px] font-medium shrink-0"
            >
              {item.story_points}
            </Badge>
          )}
        </div>

        {/* Title */}
        <p
          className={cn(
            "text-sm font-medium leading-snug line-clamp-2",
            item.status === "done" && "line-through text-muted-foreground",
          )}
        >
          {item.title}
        </p>

        {/* Footer row */}
        <div className="flex items-center justify-between gap-1 pt-0.5">
          <div className="flex items-center gap-2">
            {/* Priority flag */}
            <Flag
              className={cn(
                "h-3 w-3 shrink-0",
                PRIORITY_ICON_COLORS[item.priority],
              )}
              aria-label={`Priority: ${item.priority}`}
            />

            {/* Due date */}
            {dueDateLabel && (
              <span
                className={cn(
                  "flex items-center gap-0.5 text-[11px] tabular-nums",
                  isOverdue
                    ? "text-destructive font-medium"
                    : "text-muted-foreground",
                )}
              >
                <CalendarDays className="h-3 w-3" />
                {dueDateLabel}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {/* Subtasks */}
            {subtaskCount > 0 && (
              <span
                className={cn(
                  "flex items-center gap-0.5 text-[11px]",
                  allSubtasksDone
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-muted-foreground",
                )}
              >
                <CheckSquare className="h-3 w-3" />
                {doneSubtaskCount}/{subtaskCount}
              </span>
            )}

            {/* Critical badge */}
            {item.priority === "critical" && (
              <Badge
                variant={PRIORITY_BADGE_VARIANT[item.priority]}
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
