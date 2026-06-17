"use client";

import {
  format,
  addDays,
  startOfWeek,
  startOfMonth,
  isSameMonth,
  isSameDay,
  isToday,
  parseISO,
} from "date-fns";
import { cn } from "@/lib/utils";
import type { CalendarEvent, TimeBlockSummary } from "@/types";
import { EVENT_COLORS } from "../utils";
import { useCalendarStore } from "../store";
import { useDroppable } from "@dnd-kit/core";

// ─── Month Day Cell ───────────────────────────────────────────────────────────

interface MonthDayCellProps {
  day: Date;
  anchorDate: Date;
  events: CalendarEvent[];
  timeBlocks: TimeBlockSummary[];
}

function MonthDayCell({ day, anchorDate, events, timeBlocks }: MonthDayCellProps) {
  const { openEventDialog, openTimeBlockDialog, goToDate, setView } =
    useCalendarStore();
  const isCurrentMonth = isSameMonth(day, anchorDate);

  const { setNodeRef, isOver } = useDroppable({
    id: `month-day-${day.toISOString()}`,
    data: { day },
  });

  const visibleEvents = events.slice(0, 3);
  const hiddenCount = events.length + timeBlocks.length - 3;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-[100px] border-r border-b p-1 last:border-r-0 flex flex-col gap-0.5",
        !isCurrentMonth && "bg-muted/30",
        isOver && "bg-primary/5",
      )}
    >
      {/* Day number */}
      <button
        className={cn(
          "w-6 h-6 text-xs font-medium rounded-full flex items-center justify-center self-start hover:bg-accent transition-colors",
          isToday(day) && "bg-primary text-primary-foreground hover:bg-primary/90",
          !isCurrentMonth && "text-muted-foreground",
        )}
        onClick={() => {
          goToDate(day);
          setView("day");
        }}
        aria-label={format(day, "MMMM d, yyyy")}
      >
        {format(day, "d")}
      </button>

      {/* Events */}
      {visibleEvents.map((e) => (
        <button
          key={e.id}
          onClick={(ev) => {
            ev.stopPropagation();
            openEventDialog({ id: e.id });
          }}
          className={cn(
            "text-left text-[10px] rounded px-1 leading-4 truncate w-full",
            EVENT_COLORS.default.bg,
            EVENT_COLORS.default.text,
          )}
          title={e.title}
        >
          {!e.all_day && (
            <span className="opacity-60 mr-0.5">
              {format(parseISO(e.start_time), "h:mm")}
            </span>
          )}
          {e.title}
        </button>
      ))}

      {/* Time blocks (fill remaining slots up to 3 total) */}
      {timeBlocks.slice(0, Math.max(0, 3 - visibleEvents.length)).map((b) => (
        <button
          key={b.id}
          onClick={(ev) => {
            ev.stopPropagation();
            openTimeBlockDialog({ id: b.id });
          }}
          className={cn(
            "text-left text-[10px] rounded px-1 leading-4 truncate w-full",
            EVENT_COLORS.timeblock.bg,
            EVENT_COLORS.timeblock.text,
          )}
          title={b.title}
        >
          <span className="opacity-60 mr-0.5">
            {format(parseISO(b.start_time), "h:mm")}
          </span>
          {b.title}
        </button>
      ))}

      {/* +N more */}
      {hiddenCount > 0 && (
        <button
          className="text-[10px] text-muted-foreground hover:text-foreground transition-colors self-start px-1"
          onClick={() => {
            goToDate(day);
            setView("day");
          }}
        >
          +{hiddenCount} more
        </button>
      )}
    </div>
  );
}

// ─── MonthGrid ────────────────────────────────────────────────────────────────

interface MonthGridProps {
  anchorDate: Date;
  events: CalendarEvent[];
  timeBlocks: TimeBlockSummary[];
}

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function MonthGrid({ anchorDate, events, timeBlocks }: MonthGridProps) {
  const monthStart = startOfMonth(anchorDate);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });

  // Build 6 weeks × 7 days
  const weeks: Date[][] = [];
  for (let w = 0; w < 6; w++) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(addDays(calStart, w * 7 + d));
    }
    weeks.push(week);
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 border-b">
        {DOW_LABELS.map((label) => (
          <div
            key={label}
            className="text-center text-xs font-medium text-muted-foreground py-2 uppercase tracking-wide"
          >
            {label}
          </div>
        ))}
      </div>

      {/* Weeks */}
      <div className="flex-1 overflow-y-auto">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7">
            {week.map((day) => {
              const dayEvents = events.filter((e) =>
                isSameDay(parseISO(e.start_time), day),
              );
              const dayBlocks = timeBlocks.filter((b) =>
                isSameDay(parseISO(b.start_time), day),
              );
              return (
                <MonthDayCell
                  key={day.toISOString()}
                  day={day}
                  anchorDate={anchorDate}
                  events={dayEvents}
                  timeBlocks={dayBlocks}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
