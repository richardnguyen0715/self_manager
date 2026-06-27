"use client";

import React, { useRef, useState } from "react";
import {
  format,
  addDays,
  startOfWeek,
  isSameDay,
  isToday,
  parseISO,
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
  // Recurring occurrences carry a synthetic id "<master>__<ts>"; edit the master.
  const masterId = event.id.includes("__") ? event.id.split("__")[0] : event.id;
  const color = event.color || null;

  return (
    <div
      className={cn(
        "absolute rounded-md border-l-2 px-1.5 py-0.5 cursor-pointer transition-opacity hover:opacity-90 overflow-hidden z-10",
        !color && [EVENT_COLORS.default.bg, EVENT_COLORS.default.border, EVENT_COLORS.default.text],
      )}
      style={{
        top: topPx + 1,
        height: heightPx - 2,
        left: `${leftPct + 1}%`,
        width: `${widthPct - 2}%`,
        ...(color
          ? { backgroundColor: `${color}26`, borderLeftColor: color, color }
          : {}),
      }}
      onClick={() => openEventDialog({ id: masterId })}
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
  /**
   * Called when an empty slot is clicked, with the slot's start/end datetimes.
   * When omitted, an empty-slot click opens the time-block dialog (default
   * project-Calendar behaviour). The Life Calendar passes a handler that opens
   * the event dialog instead, so it stays event-centric.
   */
  onSlotClick?: (start: Date, end: Date) => void;
}

function DayColumn({ day, events, timeBlocks, onSlotClick }: DayColumnProps) {
  const { openTimeBlockDialog } = useCalendarStore();
  const columnRef = useRef<HTMLDivElement>(null);

  // Click-and-drag selection to create an event over a time range.
  const [sel, setSel] = useState<{ startMin: number; endMin: number } | null>(null);
  const dragAnchorRef = useRef<number | null>(null);

  const minutesAt = (clientY: number): number => {
    const rect = columnRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    return Math.max(0, Math.min(24 * 60, pxToMinutes(clientY - rect.top)));
  };

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

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only start a selection on the grid background, not on a chip.
    if ((e.target as HTMLElement).dataset.grid !== "true") return;
    const m = minutesAt(e.clientY);
    dragAnchorRef.current = m;
    setSel({ startMin: m, endMin: m + 15 });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dragAnchorRef.current === null) return;
    const m = minutesAt(e.clientY);
    const a = Math.min(dragAnchorRef.current, m);
    const b = Math.max(dragAnchorRef.current, m);
    setSel({ startMin: a, endMin: Math.max(b, a + 15) });
  };

  const finishDrag = () => {
    if (dragAnchorRef.current === null || !sel) {
      dragAnchorRef.current = null;
      setSel(null);
      return;
    }
    let { startMin, endMin } = sel;
    // A near-zero drag is a plain click → default to a 60-minute slot.
    if (endMin - startMin < 20) endMin = startMin + 60;
    dragAnchorRef.current = null;
    setSel(null);

    const start = minutesToDatetime(day, startMin);
    const end = minutesToDatetime(day, endMin);
    if (onSlotClick) {
      onSlotClick(start, end);
    } else {
      openTimeBlockDialog({ start: start.toISOString(), end: end.toISOString() });
    }
  };

  return (
    <div className="flex flex-col flex-1" style={{ minWidth: 80 }}>
      {/* Time slots (day headers are rendered in a fixed row above the scroll) */}
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
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={finishDrag}
        onMouseLeave={() => dragAnchorRef.current !== null && finishDrag()}
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

        {/* Drag-to-create selection overlay */}
        {sel && (
          <div
            className="absolute left-1 right-1 z-10 rounded-md border border-primary/50 bg-primary/20 pointer-events-none"
            style={{
              top: (sel.startMin / 60) * HOUR_HEIGHT_PX,
              height: ((sel.endMin - sel.startMin) / 60) * HOUR_HEIGHT_PX,
            }}
          />
        )}

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
  // Hours only — day headers live in a fixed row above the scroll area, so the
  // gutter, grid lines, and events all share the same origin (no offset).
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
  /** Forwarded to each day column; see DayColumnProps.onSlotClick. */
  onSlotClick?: (start: Date, end: Date) => void;
}

export function TimeGrid({ days, events, timeBlocks, showDayHeaders = true, onSlotClick }: TimeGridProps) {
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
      {/* Day-of-week header row — fixed above the scroll so it never shifts the
          time grid's coordinate origin (keeps labels/lines/events aligned). */}
      {showDayHeaders && (
        <div className="flex shrink-0" style={{ minWidth: gridMinWidth + 56 }}>
          <div className="w-14 shrink-0" />
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
                onSlotClick={onSlotClick}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
