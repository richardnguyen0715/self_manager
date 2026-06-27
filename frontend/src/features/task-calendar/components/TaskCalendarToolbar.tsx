"use client";

import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { format, startOfWeek, endOfWeek } from "date-fns";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTaskUIStore } from "@/features/tasks/store";
import { useTaskCalendarStore } from "../store";
import type { TaskCalendarViewMode } from "../store";

const VIEW_LABELS: Record<TaskCalendarViewMode, string> = {
  day: "Day",
  week: "Week",
  month: "Month",
};

function formatViewTitle(view: TaskCalendarViewMode, anchorDate: Date): string {
  switch (view) {
    case "day":
      return format(anchorDate, "EEEE, MMMM d, yyyy");
    case "week": {
      const ws = startOfWeek(anchorDate, { weekStartsOn: 0 });
      const we = endOfWeek(anchorDate, { weekStartsOn: 0 });
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

export function TaskCalendarToolbar() {
  const { view, anchorDate, setView, goToPrev, goToNext, goToToday } =
    useTaskCalendarStore();
  const openCreateDialog = useTaskUIStore((s) => s.openCreateDialog);

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
          {formatViewTitle(view, anchorDate)}
        </h2>
      </div>

      {/* Right: view switcher + create */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex rounded-md border overflow-hidden">
          {(["day", "week", "month"] as TaskCalendarViewMode[]).map((v) => (
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

        <Button size="sm" onClick={() => openCreateDialog()}>
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">New Task</span>
        </Button>
      </div>
    </div>
  );
}
