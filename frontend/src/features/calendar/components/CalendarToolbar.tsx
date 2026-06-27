"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays, Tags } from "lucide-react";
import { format, startOfWeek, endOfWeek } from "date-fns";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCalendarStore } from "../store";
import type { CalendarView } from "../store";
import { useCalendarPrefs } from "../prefs";
import { CalendarTypesDialog } from "./CalendarTypesDialog";

const VIEW_LABELS: Record<CalendarView, string> = {
  day: "Day",
  week: "Week",
  month: "Month",
};

function formatViewTitle(view: CalendarView, anchorDate: Date, weekStartsOn: 0 | 1): string {
  switch (view) {
    case "day":
      return format(anchorDate, "EEEE, MMMM d, yyyy");
    case "week": {
      const ws = startOfWeek(anchorDate, { weekStartsOn });
      const we = endOfWeek(anchorDate, { weekStartsOn });
      if (ws.getMonth() === we.getMonth()) {
        return `${format(ws, "MMMM d")} – ${format(we, "d, yyyy")}`;
      }
      if (ws.getFullYear() === we.getFullYear()) {
        return `${format(ws, "MMM d")} – ${format(we, "MMM d, yyyy")}`;
      }
      return `${format(ws, "MMM d, yyyy")} – ${format(we, "MMM d, yyyy")}`;
    }
    case "month":
      return format(anchorDate, "MMMM yyyy");
  }
}

export function CalendarToolbar() {
  const { view, anchorDate, setView, goToPrev, goToNext, goToToday, openEventDialog } =
    useCalendarStore();
  const { weekStartsOn, setWeekStartsOn } = useCalendarPrefs();
  const [typesOpen, setTypesOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b">
      {/* Left: nav controls */}
      <div className="flex items-center gap-2 min-w-0">
        <Button variant="outline" size="sm" onClick={goToToday}>
          Today
        </Button>
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={goToPrev}
            aria-label="Previous period"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={goToNext}
            aria-label="Next period"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <h2 className="text-sm sm:text-base font-semibold tabular-nums truncate min-w-0">
          {formatViewTitle(view, anchorDate, weekStartsOn)}
        </h2>
      </div>

      {/* Right: view switcher + create */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Week-start toggle */}
        <div
          className="hidden sm:flex rounded-md border overflow-hidden"
          title="First day of week"
        >
          {([0, 1] as const).map((d) => (
            <button
              key={d}
              onClick={() => setWeekStartsOn(d)}
              className={cn(
                "px-2.5 py-1.5 text-xs font-medium transition-colors",
                weekStartsOn === d
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-foreground hover:bg-accent",
              )}
            >
              {d === 0 ? "Sun" : "Mon"}
            </button>
          ))}
        </div>

        {/* View toggle */}
        <div className="flex rounded-md border overflow-hidden">
          {(["day", "week", "month"] as CalendarView[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium transition-colors",
                view === v
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              {VIEW_LABELS[v]}
            </button>
          ))}
        </div>

        <Button variant="outline" size="sm" onClick={() => setTypesOpen(true)}>
          <Tags className="h-4 w-4" />
          <span className="hidden sm:inline">Calendars</span>
        </Button>

        <Button size="sm" onClick={() => openEventDialog()}>
          <CalendarDays className="h-4 w-4" />
          <span className="hidden sm:inline">New Event</span>
        </Button>
      </div>

      <CalendarTypesDialog open={typesOpen} onOpenChange={setTypesOpen} />
    </div>
  );
}
