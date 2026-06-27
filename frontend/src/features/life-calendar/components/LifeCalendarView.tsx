"use client";

import { useCallback, useMemo } from "react";
import { addDays, startOfWeek, parseISO } from "date-fns";
import { Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CalendarEvent } from "@/types";

// Reuse the shared (user-scoped) calendar primitives. Calendar events and time
// blocks are owned by the user — not by any project — so this personal "Life
// Calendar" renders the exact same data layer the project Calendar uses, minus
// the project-task panel and task drag-and-drop.
import { useCalendarStore, getViewRange } from "@/features/calendar/store";
import { useCalendarPrefs } from "@/features/calendar/prefs";
import { useCalendarEvents } from "@/features/calendar/hooks/useCalendarEvents";
import { useCalendarTimeBlocks } from "@/features/calendar/hooks/useCalendarTimeBlocks";
import { useCalendarTypes } from "@/features/calendar/hooks/useCalendarTypes";
import { expandOccurrences } from "@/features/calendar/recurrence";
import { TimeGrid } from "@/features/calendar/components/TimeGrid";
import { MonthGrid } from "@/features/calendar/components/MonthGrid";
import { CalendarToolbar } from "@/features/calendar/components/CalendarToolbar";
import { EventFormDialog } from "@/features/calendar/components/EventFormDialog";
import { TimeBlockFormDialog } from "@/features/calendar/components/TimeBlockFormDialog";

// ─── LifeCalendarView ───────────────────────────────────────────────────────
//
// A Notion-Calendar-style personal calendar for managing life — events and
// time blocks — independent of any project. It is event-centric: clicking an
// empty time slot opens the New Event dialog (the project Calendar opens the
// time-block dialog instead).

export function LifeCalendarView() {
  const { view, anchorDate, openEventDialog } = useCalendarStore();
  const weekStartsOn = useCalendarPrefs((s) => s.weekStartsOn);

  const { start, end } = useMemo(
    () => getViewRange(view, anchorDate, weekStartsOn),
    [view, anchorDate, weekStartsOn],
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

  const { data: calendarTypes } = useCalendarTypes();

  // Resolve display colour (first assigned type → its colour, else event colour)
  // and expand recurring events into concrete occurrences within the window.
  const displayEvents = useMemo<CalendarEvent[]>(() => {
    const typeColor = new Map(
      (calendarTypes ?? []).map((t) => [t.id, t.color] as const),
    );
    const out: CalendarEvent[] = [];
    for (const ev of events ?? []) {
      const color =
        ev.type_ids?.map((id) => typeColor.get(id)).find(Boolean) ??
        ev.color ??
        null;
      const anchorStart = parseISO(ev.start_time);
      const durationMs = parseISO(ev.end_time).getTime() - anchorStart.getTime();
      const occurrences = expandOccurrences(anchorStart, ev.recurrence_rule, start, end);
      for (const occStart of occurrences) {
        const isRecurring = Boolean(ev.recurrence_rule);
        out.push({
          ...ev,
          // Synthetic id per occurrence; chips strip the suffix to edit master.
          id: isRecurring ? `${ev.id}__${occStart.getTime()}` : ev.id,
          start_time: occStart.toISOString(),
          end_time: new Date(occStart.getTime() + durationMs).toISOString(),
          color,
        });
      }
    }
    return out;
  }, [events, calendarTypes, start, end]);

  // Event-centric empty-slot behaviour: create an event at the clicked slot.
  const handleSlotClick = useCallback(
    (slotStart: Date, slotEnd: Date) => {
      openEventDialog({
        start: slotStart.toISOString(),
        end: slotEnd.toISOString(),
      });
    },
    [openEventDialog],
  );

  // Day array for week/day views (month view builds its own days).
  const days = useMemo(() => {
    if (view === "day") return [anchorDate];
    if (view === "week") {
      const ws = startOfWeek(anchorDate, { weekStartsOn });
      return Array.from({ length: 7 }, (_, i) => addDays(ws, i));
    }
    return [];
  }, [view, anchorDate, weekStartsOn]);

  const isLoading = eventsLoading || blocksLoading;
  const isError = eventsError || blocksError;

  return (
    <div className="flex flex-col h-full min-h-0 gap-3">
      {/* Toolbar — Today / prev / next, view switcher, New Event */}
      <CalendarToolbar />

      {/* Error */}
      {isError && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Failed to load your calendar. Please try again.
        </div>
      )}

      {/* Calendar body */}
      <div
        className={cn(
          "flex flex-col flex-1 min-h-0 rounded-lg border overflow-hidden",
          isLoading && "relative",
        )}
      >
        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/60">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        <div className="flex flex-col flex-1 min-h-0 min-w-0 overflow-x-auto">
          {view === "month" ? (
            <MonthGrid
              anchorDate={anchorDate}
              events={displayEvents}
              timeBlocks={timeBlocks ?? []}
              weekStartsOn={weekStartsOn}
            />
          ) : (
            <TimeGrid
              days={days}
              events={displayEvents}
              timeBlocks={timeBlocks ?? []}
              showDayHeaders={view === "week"}
              onSlotClick={handleSlotClick}
            />
          )}
        </div>
      </div>

      {/* Dialogs */}
      <EventFormDialog />
      <TimeBlockFormDialog />
    </div>
  );
}
