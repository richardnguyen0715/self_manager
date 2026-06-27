"use client";

import React, { useRef, useCallback } from "react";
import { format, isToday, isSameDay, parseISO, addMinutes, startOfDay } from "date-fns";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import type { TaskListItem } from "@/types";
import { useTaskUIStore } from "@/features/tasks/store";
import {
  HOURS,
  HOUR_HEIGHT_PX,
  datetimeToTopPx,
  durationToHeightPx,
  formatHourLabel,
  formatTimeLabel,
  computeEventLayout,
  getPriorityColors,
  pxToMinutes,
  minutesToDatetime,
} from "@/features/calendar/utils";

const DEFAULT_DURATION_MIN = 60;

// ─── Current-time indicator ───────────────────────────────────────────────────

function NowIndicator() {
  const top = datetimeToTopPx(new Date());
  return (
    <div
      className="absolute left-0 right-0 z-20 flex items-center pointer-events-none"
      style={{ top }}
    >
      <div className="w-2 h-2 rounded-full bg-red-500 -ml-1 shrink-0" />
      <div className="flex-1 h-px bg-red-500" />
    </div>
  );
}

// ─── Task chip ────────────────────────────────────────────────────────────────

interface TaskChipProps {
  task: TaskListItem;
  topPx: number;
  heightPx: number;
  column: number;
  totalColumns: number;
}

function TaskChip({ task, topPx, heightPx, column, totalColumns }: TaskChipProps) {
  const openEditDialog = useTaskUIStore((s) => s.openEditDialog);
  const colors = getPriorityColors(task.priority);
  const short = heightPx < 32;
  const widthPct = 100 / totalColumns;
  const leftPct = column * widthPct;

  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: `task-chip-${task.id}`, data: { type: "task", task } });

  const start = task.due_date ? parseISO(task.due_date) : null;

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(
        "absolute rounded-md border-l-2 px-1.5 py-0.5 overflow-hidden cursor-pointer transition-opacity hover:opacity-90 z-10",
        colors.bg,
        colors.border,
        colors.text,
        isDragging && "opacity-40",
      )}
      style={{
        top: topPx + 1,
        height: heightPx - 2,
        left: `${leftPct + 1}%`,
        width: `${widthPct - 2}%`,
        transform: CSS.Translate.toString(transform),
      }}
      // Pointer-down starts a drag; a click without movement edits.
      onClick={() => openEditDialog(task.id)}
      title={task.title}
    >
      <p className={cn("font-medium leading-tight truncate", short ? "text-[10px]" : "text-xs")}>
        {task.title}
      </p>
      {!short && start && (
        <p className="text-[10px] opacity-70 truncate">{formatTimeLabel(start)}</p>
      )}
    </div>
  );
}

// ─── Time gutter ───────────────────────────────────────────────────────────────

function TimeGutter() {
  // Hours only — day headers live in a fixed row above the scroll area.
  return (
    <div
      className="flex flex-col shrink-0 w-14 select-none"
      style={{ height: HOUR_HEIGHT_PX * 24 }}
    >
      {HOURS.map((hour) => (
        <div
          key={hour}
          className="relative flex items-start justify-end pr-2"
          style={{ height: HOUR_HEIGHT_PX }}
        >
          {hour > 0 && (
            <span className="text-[10px] text-muted-foreground -mt-2 tabular-nums">
              {formatHourLabel(hour)}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Droppable day column ───────────────────────────────────────────────────────

interface DayColumnProps {
  day: Date;
  tasks: TaskListItem[];
}

function DayColumn({ day, tasks }: DayColumnProps) {
  const openCreateDialog = useTaskUIStore((s) => s.openCreateDialog);
  const columnRef = useRef<HTMLDivElement>(null);

  const { setNodeRef, isOver } = useDroppable({
    id: `task-day-${day.toISOString()}`,
    data: { day },
  });

  // Lay out the day's tasks by due time, sized to estimated_time.
  const positioned = computeEventLayout(
    tasks.map((t) => {
      const start = t.due_date ? parseISO(t.due_date) : startOfDay(day);
      const dur = t.estimated_time ?? DEFAULT_DURATION_MIN;
      return { item: t, start, end: addMinutes(start, dur) };
    }),
  );

  const handleGridClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).dataset.grid !== "true") return;
      const rect = columnRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mins = pxToMinutes(e.clientY - rect.top);
      const start = minutesToDatetime(day, mins);
      openCreateDialog({ due_date: start.toISOString() });
    },
    [day, openCreateDialog],
  );

  return (
    <div className="flex flex-col flex-1" style={{ minWidth: 80 }}>
      <div
        ref={(node) => {
          (columnRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
          setNodeRef(node);
        }}
        className={cn(
          "relative shrink-0 border-r last:border-r-0",
          isOver && "bg-primary/5",
        )}
        style={{ height: HOUR_HEIGHT_PX * 24 }}
        onClick={handleGridClick}
        data-grid="true"
      >
        {HOURS.map((hour) => (
          <div
            key={hour}
            data-grid="true"
            className="absolute left-0 right-0 border-t-2 border-border"
            style={{ top: hour * HOUR_HEIGHT_PX }}
          />
        ))}
        {HOURS.map((hour) => (
          <div
            key={`${hour}-half`}
            data-grid="true"
            className="absolute left-0 right-0 border-t border-border/60 border-dashed"
            style={{ top: hour * HOUR_HEIGHT_PX + HOUR_HEIGHT_PX / 2 }}
          />
        ))}

        {isToday(day) && <NowIndicator />}

        {positioned.map((pos) => (
          <TaskChip
            key={pos.item.item.id}
            task={pos.item.item}
            topPx={pos.topPx}
            heightPx={pos.heightPx}
            column={pos.column}
            totalColumns={pos.totalColumns}
          />
        ))}
      </div>
    </div>
  );
}

// ─── TaskTimeGrid (day / week) ──────────────────────────────────────────────────

interface TaskTimeGridProps {
  days: Date[];
  tasks: TaskListItem[];
  showDayHeaders?: boolean;
}

export function TaskTimeGrid({ days, tasks, showDayHeaders = true }: TaskTimeGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const minColWidth = 80;
  const gridMinWidth = days.length > 1 ? days.length * minColWidth : 0;

  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = HOUR_HEIGHT_PX * 7;
  }, []);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Fixed day-of-week header row above the scroll → keeps the time grid's
          origin shared between gutter labels, grid lines, and task chips. */}
      {showDayHeaders && (
        <div className="flex shrink-0" style={{ minWidth: gridMinWidth + 56 }}>
          <div className="w-14 shrink-0 border-b" />
          <div className="flex flex-1">
            {days.map((day) => (
              <div
                key={day.toISOString()}
                className={cn(
                  "flex-1 h-12 flex flex-col items-center justify-center border-b border-r last:border-r-0 text-sm select-none",
                  isToday(day) && "text-primary",
                )}
                style={{ minWidth: minColWidth }}
              >
                <span className="text-xs font-medium text-muted-foreground uppercase">
                  {format(day, "EEE")}
                </span>
                <span
                  className={cn(
                    "w-7 h-7 flex items-center justify-center rounded-full font-semibold text-sm",
                    isToday(day) && "bg-primary text-primary-foreground",
                  )}
                >
                  {format(day, "d")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div ref={scrollRef} className="flex flex-1 overflow-y-auto overflow-x-auto min-h-0">
        <div className="flex flex-1" style={{ minWidth: gridMinWidth + 56 }}>
          <TimeGutter />
          <div className="flex flex-1 min-w-0">
            {days.map((day) => (
              <DayColumn
                key={day.toISOString()}
                day={day}
                tasks={tasks.filter(
                  (t) => t.due_date && isSameDay(parseISO(t.due_date), day),
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
