"use client";

import React, { useRef, useCallback } from "react";
import {
  format,
  addDays,
  startOfWeek,
  isSameDay,
  isToday,
  parseISO,
  addMinutes,
  startOfDay,
} from "date-fns";
import { cn } from "@/lib/utils";
import type { CalendarEvent, TimeBlockSummary } from "@/types";
import {
  HOURS,
  HOUR_HEIGHT_PX,
  datetimeToTopPx,
  durationToHeightPx,
  formatHourLabel,
  formatTimeLabel,
  eventsForDay,
  timeBlocksForDay,
  computeEventLayout,
  pxToMinutes,
  minutesToDatetime,
  EVENT_COLORS,
} from "../utils";
import { useCalendarStore } from "../store";
import { useDroppable } from "@dnd-kit/core";

// ─── Current time indicator ───────────────────────────────────────────────────

function NowIndicator() {
  const now = new Date();
  const top = datetimeToTopPx(now);
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

// ─── Individual event chip ────────────────────────────────────────────────────

interface EventChipProps {
  event: CalendarEvent;
  topPx: number;
  heightPx: number;
  column: number;
  totalColumns: number;
}

function EventChip({ event, topPx, heightPx, column, totalColumns }: EventChipProps) {
  const { openEventDialog } = useCalendarStore();
  const widthPct = 100 / totalColumns;
  const leftPct = column * widthPct;
  const short = heightPx < 32;

  return (
    <div
      className={cn(
        "absolute rounded-md border-l-2 px-1.5 py-0.5 cursor-pointer transition-opacity hover:opacity-90 overflow-hidden",
        EVENT_COLORS.default.bg,
        EVENT_COLORS.default.border,
        EVENT_COLORS.default.text,
        "z-10",
      )}
      style={{
        top: topPx + 1,
        height: heightPx - 2,
        left: `${leftPct + 1}%`,
        width: `${widthPct - 2}%`,
      }}
      onClick={() => openEventDialog({ id: event.id })}
      title={`${event.title}\n${formatTimeLabel(parseISO(event.start_time))} – ${formatTimeLabel(parseISO(event.end_time))}`}
    >
      <p className={cn("font-medium leading-tight truncate", short ? "text-[10px]" : "text-xs")}>
        {event.title}
      </p>
      {!short && (
        <p className="text-[10px] opacity-70 truncate">
          {formatTimeLabel(parseISO(event.start_time))}
        </p>
      )}
    </div>
  );
}

// ─── Time block chip ─────────────────────────────────────────────────────────

interface TimeBlockChipProps {
  block: TimeBlockSummary;
  topPx: number;
  heightPx: number;
  column: number;
  totalColumns: number;
}

function TimeBlockChip({ block, topPx, heightPx, column, totalColumns }: TimeBlockChipProps) {
  const { openTimeBlockDialog } = useCalendarStore();
  const widthPct = 100 / totalColumns;
  const leftPct = column * widthPct;
  const short = heightPx < 32;
  const colors = EVENT_COLORS.timeblock;

  return (
    <div
      className={cn(
        "absolute rounded-md border-l-2 px-1.5 py-0.5 cursor-pointer transition-opacity hover:opacity-90 overflow-hidden",
        colors.bg,
        colors.border,
        colors.text,
        "z-10",
      )}
      style={{
        top: topPx + 1,
        height: heightPx - 2,
        left: `${leftPct + 1}%`,
        width: `${widthPct - 2}%`,
      }}
      onClick={() => openTimeBlockDialog({ id: block.id })}
      title={`${block.title}\n${formatTimeLabel(parseISO(block.start_time))} – ${formatTimeLabel(parseISO(block.end_time))}`}
    >
      <p className={cn("font-medium leading-tight truncate", short ? "text-[10px]" : "text-xs")}>
        {block.title}
      </p>
      {!short && (
        <p className="text-[10px] opacity-70 truncate">
          {formatTimeLabel(parseISO(block.start_time))}
        </p>
      )}
    </div>
  );
}

// ─── Droppable day column ─────────────────────────────────────────────────────

interface DayColumnProps {
  day: Date;
  events: CalendarEvent[];
  timeBlocks: TimeBlockSummary[];
  showDayHeader: boolean;
}

function DayColumn({ day, events, timeBlocks, showDayHeader }: DayColumnProps) {
  const { openTimeBlockDialog } = useCalendarStore();
  const columnRef = useRef<HTMLDivElement>(null);

  const { setNodeRef, isOver } = useDroppable({
    id: `day-column-${day.toISOString()}`,
    data: { day },
  });

  // Build event layout — combine CalendarEvents and TimeBlocks into a unified
  // interval list, then annotate each with column/totalColumns.
  const eventItems = events
    .filter((e) => !e.all_day)
    .map((e) => ({
      type: "event" as const,
      item: e,
      start: parseISO(e.start_time),
      end: parseISO(e.end_time),
    }));

  const blockItems = timeBlocks.map((b) => ({
    type: "timeblock" as const,
    item: b,
    start: parseISO(b.start_time),
    end: parseISO(b.end_time),
  }));

  const allItems = [...eventItems, ...blockItems];
  const positioned = computeEventLayout(allItems);

  const handleGridClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Only register direct clicks on the grid background, not on chips
      if ((e.target as HTMLElement).dataset.grid !== "true") return;
      const rect = columnRef.current?.getBoundingClientRect();
      if (!rect) return;
      const offsetY = e.clientY - rect.top;
      const mins = pxToMinutes(offsetY);
      const start = minutesToDatetime(day, mins);
      const end = addMinutes(start, 60);
      openTimeBlockDialog({
        start: start.toISOString(),
        end: end.toISOString(),
      });
    },
    [day, openTimeBlockDialog],
  );

  return (
    <div className="flex flex-col flex-1" style={{ minWidth: 80 }}>
      {/* Day header */}
      {showDayHeader && (
        <div
          className={cn(
            "h-12 flex flex-col items-center justify-center border-b text-sm select-none",
            isToday(day) && "text-primary",
          )}
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
      )}

      {/* Time slots */}
      <div
        ref={(node) => {
          (columnRef as React.MutableRefObject<HTMLDivElement | null>).current =
            node;
          setNodeRef(node);
        }}
        className={cn(
          "relative flex-1 border-r last:border-r-0",
          isOver && "bg-primary/5",
        )}
        style={{ height: HOUR_HEIGHT_PX * 24 }}
        onClick={handleGridClick}
        data-grid="true"
      >
        {/* Hour grid lines */}
        {HOURS.map((hour) => (
          <div
            key={hour}
            data-grid="true"
            className="absolute left-0 right-0 border-t border-border/40"
            style={{ top: hour * HOUR_HEIGHT_PX }}
          />
        ))}

        {/* Half-hour lines */}
        {HOURS.map((hour) => (
          <div
            key={`${hour}-half`}
            data-grid="true"
            className="absolute left-0 right-0 border-t border-border/20 border-dashed"
            style={{ top: hour * HOUR_HEIGHT_PX + HOUR_HEIGHT_PX / 2 }}
          />
        ))}

        {/* Today indicator */}
        {isToday(day) && <NowIndicator />}

        {/* Positioned events and time blocks */}
        {positioned.map((pos, idx) => {
          if (pos.item.type === "event") {
            return (
              <EventChip
                key={`event-${pos.item.item.id}`}
                event={pos.item.item}
                topPx={pos.topPx}
                heightPx={pos.heightPx}
                column={pos.column}
                totalColumns={pos.totalColumns}
              />
            );
          }
          return (
            <TimeBlockChip
              key={`block-${pos.item.item.id}`}
              block={pos.item.item}
              topPx={pos.topPx}
              heightPx={pos.heightPx}
              column={pos.column}
              totalColumns={pos.totalColumns}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── Time gutter ─────────────────────────────────────────────────────────────

function TimeGutter() {
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

// ─── TimeGrid (Day view) ──────────────────────────────────────────────────────

interface TimeGridProps {
  days: Date[];
  events: CalendarEvent[];
  timeBlocks: TimeBlockSummary[];
  showDayHeaders?: boolean;
}

export function TimeGrid({ days, events, timeBlocks, showDayHeaders = true }: TimeGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Min width per day column so week view scrolls on narrow screens
  const minColWidth = 80; // px
  const gridMinWidth = days.length > 1 ? days.length * minColWidth : 0;

  // Scroll to 7 AM on mount
  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = HOUR_HEIGHT_PX * 7;
    }
  }, []);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* All-day row */}
      {showDayHeaders && (
        <div className="flex border-b shrink-0" style={{ minWidth: gridMinWidth + 56 }}>
          {/* Spacer for gutter */}
          <div className="w-14 shrink-0" />
          <div className="flex flex-1">
            {days.map((day) => {
              const allDay = events.filter(
                (e) => e.all_day && isSameDay(parseISO(e.start_time), day),
              );
              return (
                <div
                  key={day.toISOString()}
                  className="flex-1 min-h-[2rem] border-r last:border-r-0 px-1 py-0.5"
                  style={{ minWidth: minColWidth }}
                >
                  {allDay.map((e) => (
                    <div
                      key={e.id}
                      className={cn(
                        "text-xs rounded px-1 truncate cursor-pointer mb-0.5",
                        EVENT_COLORS.default.bg,
                        EVENT_COLORS.default.text,
                      )}
                    >
                      {e.title}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Scrollable time grid */}
      <div ref={scrollRef} className="flex flex-1 overflow-y-auto overflow-x-auto min-h-0">
        {/* Inner wrapper enforces min-width for horizontal scroll on narrow screens */}
        <div className="flex flex-1" style={{ minWidth: gridMinWidth + 56 }}>
          {/* Gutter */}
          <TimeGutter />

          {/* Day columns */}
          <div className="flex flex-1 min-w-0">
            {days.map((day) => (
              <DayColumn
                key={day.toISOString()}
                day={day}
                events={eventsForDay(events, day)}
                timeBlocks={timeBlocksForDay(timeBlocks, day)}
                showDayHeader={showDayHeaders}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
