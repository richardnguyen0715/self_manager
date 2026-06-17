"use client";

import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTimeBlockingStore } from "../timeblocking.store";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function offsetDate(base: string, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function formatDisplayDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  const today = new Date().toISOString().split("T")[0];
  const tomorrow = offsetDate(today, 1);
  const yesterday = offsetDate(today, -1);

  if (iso === today) return "Today";
  if (iso === tomorrow) return "Tomorrow";
  if (iso === yesterday) return "Yesterday";

  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year:
      d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DateNav() {
  const { selectedDate, setSelectedDate } = useTimeBlockingStore();
  const today = new Date().toISOString().split("T")[0];
  const isToday = selectedDate === today;

  function prev() {
    setSelectedDate(offsetDate(selectedDate, -1));
  }

  function next() {
    setSelectedDate(offsetDate(selectedDate, 1));
  }

  function goToday() {
    setSelectedDate(today);
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={prev}
        aria-label="Previous day"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <button
        type="button"
        onClick={goToday}
        className={cn(
          "flex items-center gap-1.5 rounded-md px-3 h-8 text-sm font-medium border transition-colors",
          isToday
            ? "bg-primary text-primary-foreground border-transparent"
            : "bg-background hover:bg-accent",
        )}
        aria-label="Go to today"
      >
        <CalendarDays className="h-3.5 w-3.5" />
        {formatDisplayDate(selectedDate)}
      </button>

      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={next}
        aria-label="Next day"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
