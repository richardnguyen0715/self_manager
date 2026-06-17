"use client";

import { format, isPast, isToday } from "date-fns";
import {
  Circle,
  CheckCircle2,
  Calendar,
  Clock,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { TaskListItem } from "@/types";
import { useToggleTaskComplete, useDeleteTask } from "../hooks/useTasks";
import { useTaskUIStore } from "../store";
import { PriorityBadge } from "./PriorityBadge";
import { StatusBadge } from "./StatusBadge";

interface TaskRowProps {
  task: TaskListItem;
}

function formatDueDate(dateStr: string): { label: string; overdue: boolean; today: boolean } {
  const date = new Date(dateStr);
  const overdue = isPast(date) && !isToday(date);
  const today = isToday(date);
  const label = today ? "Today" : format(date, "MMM d");
  return { label, overdue, today };
}

export function TaskRow({ task }: TaskRowProps) {
  const toggleComplete = useToggleTaskComplete();
  const deleteTask = useDeleteTask();
  const { openEditDialog } = useTaskUIStore();

  const isCompleted = task.status === "completed";
  const hasSubtasks = task.subtask_count > 0;

  function handleToggle(e: React.MouseEvent) {
    e.stopPropagation();
    toggleComplete.mutate({
      taskId: task.id,
      isCompleted: !isCompleted,
    });
  }

  function handleDelete() {
    if (confirm(`Delete "${task.title}"? This cannot be undone.`)) {
      deleteTask.mutate(task.id);
    }
  }

  return (
    <div className="group relative">
      <div
        className={cn(
          "flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors",
          "hover:bg-accent/50 cursor-pointer",
          isCompleted && "opacity-60",
        )}
        onClick={() => openEditDialog(task.id)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openEditDialog(task.id);
          }
        }}
        aria-label={`Open task: ${task.title}`}
      >
        {/* Completion toggle */}
        <button
          type="button"
          onClick={handleToggle}
          disabled={toggleComplete.isPending}
          className={cn(
            "mt-0.5 shrink-0 rounded-full transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            isCompleted
              ? "text-emerald-500 hover:text-emerald-600"
              : "text-muted-foreground hover:text-foreground",
          )}
          aria-label={isCompleted ? "Mark incomplete" : "Mark complete"}
        >
          {isCompleted ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : (
            <Circle className="h-5 w-5" />
          )}
        </button>

        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "text-sm font-medium leading-snug truncate",
                isCompleted && "line-through text-muted-foreground",
              )}
            >
              {task.title}
            </span>

            <PriorityBadge
              priority={task.priority}
              className="hidden sm:inline-flex shrink-0"
            />
          </div>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={task.status} />

            {task.due_date && (() => {
              const { label, overdue, today } = formatDueDate(task.due_date);
              return (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 text-xs",
                    overdue
                      ? "text-red-600 dark:text-red-400 font-medium"
                      : today
                        ? "text-amber-600 dark:text-amber-400 font-medium"
                        : "text-muted-foreground",
                  )}
                >
                  <Calendar className="h-3 w-3" />
                  {label}
                </span>
              );
            })()}

            {task.estimated_time != null && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {task.estimated_time}m
              </span>
            )}

            {hasSubtasks && (
              <span className="text-xs text-muted-foreground tabular-nums">
                {task.done_subtask_count}/{task.subtask_count} subtasks
              </span>
            )}

            {/* Tag count badge — full tag objects not available in list items */}
            {(task.tag_ids?.length ?? 0) > 0 && (
              <Badge variant="outline" className="px-1.5 py-0 text-[10px] h-4">
                {task.tag_ids!.length} tag{task.tag_ids!.length > 1 ? "s" : ""}
              </Badge>
            )}
          </div>
        </div>

        {/* Actions (visible on hover) */}
        <DropdownMenuPrimitive.Root>
          <DropdownMenuPrimitive.Trigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity",
                "focus-visible:opacity-100",
              )}
              onClick={(e) => e.stopPropagation()}
              aria-label="Task actions"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuPrimitive.Trigger>

          <DropdownMenuPrimitive.Portal>
            <DropdownMenuPrimitive.Content
              align="end"
              sideOffset={4}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "z-50 min-w-[10rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md",
                "data-[state=open]:animate-in data-[state=closed]:animate-out",
                "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
                "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
                "data-[side=bottom]:slide-in-from-top-2",
              )}
            >
              <DropdownMenuPrimitive.Item
                onSelect={() => openEditDialog(task.id)}
                className={cn(
                  "flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none gap-2",
                  "focus:bg-accent focus:text-accent-foreground",
                )}
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </DropdownMenuPrimitive.Item>

              <DropdownMenuPrimitive.Item
                onSelect={handleDelete}
                className={cn(
                  "flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none gap-2",
                  "focus:bg-destructive/10 focus:text-destructive text-destructive",
                )}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </DropdownMenuPrimitive.Item>
            </DropdownMenuPrimitive.Content>
          </DropdownMenuPrimitive.Portal>
        </DropdownMenuPrimitive.Root>
      </div>
    </div>
  );
}
