"use client";

import { useCallback, useMemo } from "react";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  addDays,
  startOfWeek,
  parseISO,
  setHours,
  setMinutes,
  setSeconds,
  getHours,
  getMinutes,
} from "date-fns";
import { Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TaskListItem } from "@/types";
import { TaskDialog } from "@/features/tasks/components/TaskDialog";
import { useTaskCalendarStore } from "../store";
import { useProjectTasks, useRescheduleTask } from "../hooks/useTaskCalendar";
import { TaskCalendarToolbar } from "./TaskCalendarToolbar";
import { TaskTimeGrid } from "./TaskTimeGrid";
import { TaskMonthGrid } from "./TaskMonthGrid";
import { UnscheduledTasksPanel } from "./UnscheduledTasksPanel";

// Default time-of-day when scheduling a task that had no due time yet.
const DEFAULT_HOUR = 9;

// ─── TaskCalendarView ───────────────────────────────────────────────────────
//
// The project task-timeline: every (non-completed) task for the selected
// project laid out by due date. Supports full CRUD via the shared task dialog —
// click empty space to create, click a task to edit, drag to reschedule.

export function TaskCalendarView() {
  const { view, anchorDate } = useTaskCalendarStore();
  const { scheduled, unscheduled, isLoading, isError } = useProjectTasks();
  const reschedule = useRescheduleTask();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over) return;

      const dragData = active.data.current as
        | { type: string; task: TaskListItem }
        | undefined;
      if (dragData?.type !== "task") return;

      const dropData = over.data.current as { day?: Date } | undefined;
      if (!dropData?.day) return;

      const task = dragData.task;
      // Preserve the task's existing time-of-day; default to 9 AM if none.
      const prev = task.due_date ? parseISO(task.due_date) : null;
      const hour = prev ? getHours(prev) : DEFAULT_HOUR;
      const minute = prev ? getMinutes(prev) : 0;
      const next = setSeconds(setMinutes(setHours(dropData.day, hour), minute), 0);

      // No-op if dropped on the same day it already sits on.
      if (prev && next.getTime() === prev.getTime()) return;

      reschedule.mutate({ id: task.id, due_date: next.toISOString() });
    },
    [reschedule],
  );

  const days = useMemo(() => {
    if (view === "day") return [anchorDate];
    if (view === "week") {
      const ws = startOfWeek(anchorDate, { weekStartsOn: 0 });
      return Array.from({ length: 7 }, (_, i) => addDays(ws, i));
    }
    return [];
  }, [view, anchorDate]);

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex flex-col h-full min-h-0 gap-3">
        <TaskCalendarToolbar />

        {isError && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Failed to load tasks. Please try again.
          </div>
        )}

        <div
          className={cn(
            "flex flex-col lg:flex-row flex-1 min-h-0 rounded-lg border overflow-hidden",
            isLoading && "relative",
          )}
        >
          {isLoading && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/60">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          <div className="flex flex-col flex-1 min-h-0 min-w-0 overflow-x-auto">
            {view === "month" ? (
              <TaskMonthGrid anchorDate={anchorDate} tasks={scheduled} />
            ) : (
              <TaskTimeGrid
                days={days}
                tasks={scheduled}
                showDayHeaders={view === "week"}
              />
            )}
          </div>

          <UnscheduledTasksPanel tasks={unscheduled} isLoading={isLoading} />
        </div>
      </div>

      {/* Shared task CRUD dialog */}
      <TaskDialog />
    </DndContext>
  );
}
