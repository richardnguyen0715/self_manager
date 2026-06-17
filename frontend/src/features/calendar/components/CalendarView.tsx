"use client";

import { useCallback, useMemo } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { addDays, startOfWeek, parseISO, addHours } from "date-fns";
import { Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TaskListItem } from "@/types";
import { Badge } from "@/components/ui/badge";
import { useCalendarStore, getViewRange } from "../store";
import { useCalendarEvents } from "../hooks/useCalendarEvents";
import { useCalendarTimeBlocks, useCreateTimeBlock } from "../hooks/useCalendarTimeBlocks";
import { TimeGrid } from "./TimeGrid";
import { MonthGrid } from "./MonthGrid";
import { CalendarToolbar } from "./CalendarToolbar";
import { EventFormDialog } from "./EventFormDialog";
import { TimeBlockFormDialog } from "./TimeBlockFormDialog";
import { UnscheduledTasksPanel } from "./UnscheduledTasksPanel";

// ─── Drag overlay chip ───────────────────────────────────────────────────────

function DragOverlayTask({ task }: { task: TaskListItem }) {
  return (
    <div className="flex items-center gap-2 rounded-md border bg-background px-3 py-1.5 shadow-lg text-sm max-w-[200px] cursor-grabbing opacity-90">
      <span className="truncate">{task.title}</span>
      <Badge variant={task.priority} className="text-[10px] px-1.5 py-0 shrink-0">
        {task.priority[0].toUpperCase()}
      </Badge>
    </div>
  );
}

// ─── CalendarView ─────────────────────────────────────────────────────────────

export function CalendarView() {
  const { view, anchorDate } = useCalendarStore();
  const createTimeBlock = useCreateTimeBlock();

  const { start, end } = useMemo(
    () => getViewRange(view, anchorDate),
    [view, anchorDate],
  );

  const {
    data: events,
    isLoading: eventsLoading,
    isError: eventsError,
  } = useCalendarEvents({ start, end });

  const {
    data: timeBlocks,
    isLoading: blocksLoading,
    isError: blocksError,
  } = useCalendarTimeBlocks({ start, end });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over) return;

      const dragData = active.data.current as { type: string; task: TaskListItem } | undefined;
      if (!dragData || dragData.type !== "task") return;

      const dropData = over.data.current as { day?: Date } | undefined;
      if (!dropData?.day) return;

      const task = dragData.task;
      const dropDay = dropData.day;

      // Create a time block starting at 9 AM on the dropped day,
      // sized to estimated_time (default 60 min)
      const startAt = addHours(dropDay, 9);
      const estimatedDuration = task.estimated_time ?? 60;
      const adjustedEnd = new Date(
        startAt.getTime() + estimatedDuration * 60 * 1000,
      );

      createTimeBlock.mutate({
        title: task.title,
        start_time: startAt.toISOString(),
        end_time: adjustedEnd.toISOString(),
        task_id: task.id,
      });
    },
    [createTimeBlock],
  );

  // Compute day array for week/day views
  const days = useMemo(() => {
    if (view === "day") return [anchorDate];
    if (view === "week") {
      const ws = startOfWeek(anchorDate, { weekStartsOn: 0 });
      return Array.from({ length: 7 }, (_, i) => addDays(ws, i));
    }
    return []; // month view handles its own days
  }, [view, anchorDate]);

  const isLoading = eventsLoading || blocksLoading;
  const isError = eventsError || blocksError;

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex flex-col h-full min-h-0 gap-3">
        {/* Toolbar */}
        <CalendarToolbar />

        {/* Error */}
        {isError && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Failed to load calendar data. Please try again.
          </div>
        )}

        {/* Main content area */}
        <div
          className={cn(
            "flex flex-1 min-h-0 rounded-lg border overflow-hidden",
            isLoading && "relative",
          )}
        >
          {/* Loading overlay */}
          {isLoading && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/60">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Calendar body */}
          <div className="flex flex-col flex-1 min-h-0 min-w-0">
            {view === "month" ? (
              <MonthGrid
                anchorDate={anchorDate}
                events={events ?? []}
                timeBlocks={timeBlocks ?? []}
              />
            ) : (
              <TimeGrid
                days={days}
                events={events ?? []}
                timeBlocks={timeBlocks ?? []}
                showDayHeaders={view === "week"}
              />
            )}
          </div>

          {/* Unscheduled tasks sidebar (hidden in month view on small screens) */}
          <UnscheduledTasksPanel />
        </div>
      </div>

      {/* Dialogs */}
      <EventFormDialog />
      <TimeBlockFormDialog />

      {/* Drag overlay */}
      <DragOverlay>
        {/* DragOverlay renders nothing by default; children are shown by dnd-kit
            only when a drag is active. We handle it via the useDraggable in the
            task row — the overlay is just here to suppress the default ghost. */}
      </DragOverlay>
    </DndContext>
  );
}
