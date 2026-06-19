"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Habit, HabitLog } from "@/types";
import { useHabitLogs } from "../hooks/useHabits";
import { useHabitsStore } from "../store/habits.store";
import { toISODateString } from "@/lib/utils";
import { useMemo } from "react";

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns an array of YYYY-MM-DD strings covering the last `weeks` weeks,
 * aligned to start on Sunday so the grid fills neatly.
 */
function buildDateRange(weeks: number): string[] {
  const today = new Date();
  // Walk back to the most recent Sunday
  const endSunday = new Date(today);
  endSunday.setDate(today.getDate() - today.getDay());

  const startDate = new Date(endSunday);
  startDate.setDate(endSunday.getDate() - (weeks - 1) * 7);

  const dates: string[] = [];
  const cursor = new Date(startDate);
  while (cursor <= today) {
    dates.push(toISODateString(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function intensityClass(log: HabitLog | undefined, habit: Habit): string {
  if (!log) return "bg-secondary";
  if (!log.completed) return "bg-destructive/20";
  if (habit.habit_type === "check") return "bg-emerald-500";

  // count / duration — shade by percentage of target
  if (!habit.target_value || !log.value) return "bg-emerald-300";
  const pct = log.value / habit.target_value;
  if (pct >= 1) return "bg-emerald-500";
  if (pct >= 0.75) return "bg-emerald-400";
  if (pct >= 0.5) return "bg-emerald-300";
  return "bg-emerald-200";
}

function formatTooltip(date: string, log: HabitLog | undefined, habit: Habit): string {
  const d = new Date(date + "T00:00:00");
  const label = d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  if (!log) return `${label} — no log`;
  if (!log.completed) return `${label} — skipped`;
  if (habit.habit_type === "check") return `${label} — done`;
  return `${label} — ${log.value ?? 0}`;
}

// ─── Inner heatmap grid (also exported for embedding in HabitCard) ─────────────

const WEEKS = 16;
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface HeatmapGridProps {
  habit: Habit;
  logs: HabitLog[];
  dates: string[];
}

export function HeatmapGrid({ habit, logs, dates }: HeatmapGridProps) {
  const logByDate = useMemo(() => {
    const map = new Map<string, HabitLog>();
    for (const log of logs) {
      // HabitLog uses log_date (YYYY-MM-DD)
      map.set(log.log_date, log);
    }
    return map;
  }, [logs]);

  // Chunk dates into columns of 7 (week columns)
  const weeks: string[][] = [];
  for (let i = 0; i < dates.length; i += 7) {
    weeks.push(dates.slice(i, i + 7));
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-0.5">
        {/* Day-of-week labels */}
        <div className="flex flex-col gap-0.5 pr-1">
          {DAY_LABELS.map((d) => (
            <div
              key={d}
              className="flex h-3.5 items-center text-[10px] text-muted-foreground"
            >
              {d[0]}
            </div>
          ))}
        </div>

        {/* Week columns */}
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-0.5">
            {/* Pad the first week if it doesn't start on Sunday */}
            {wi === 0 &&
              week.length < 7 &&
              Array.from({ length: 7 - week.length }).map((_, pi) => (
                <div key={`pad-${pi}`} className="h-3.5 w-3.5" />
              ))}
            {week.map((date) => {
              const log = logByDate.get(date);
              return (
                <Tooltip key={date}>
                  <TooltipTrigger asChild>
                    <div
                      className={`h-3.5 w-3.5 rounded-sm transition-opacity hover:opacity-80 ${intensityClass(log, habit)}`}
                    />
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p className="text-xs">{formatTooltip(date, log, habit)}</p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Heatmap dialog ────────────────────────────────────────────────────────────

interface HabitHeatmapDialogProps {
  open: boolean;
  habit: Habit;
}

export function HabitHeatmapDialog({ open, habit }: HabitHeatmapDialogProps) {
  const { closeModal } = useHabitsStore();

  const dates = useMemo(() => buildDateRange(WEEKS), []);
  const from = dates[0];
  const to = dates[dates.length - 1];

  const { data: logs = [], isLoading } = useHabitLogs(habit.id, from, to, open);

  // Stats derived from logs
  const { completedCount, longestStreak, currentStreak } = useMemo(() => {
    // Sort by log_date ascending
    const sorted = [...logs].sort((a, b) => a.log_date.localeCompare(b.log_date));
    const completed = sorted.filter((l) => l.completed);

    let longest = 0;
    let current = 0;
    let run = 0;
    const dateSet = new Set(completed.map((l) => l.log_date));

    // Walk from today backwards for current streak
    const todayStr = toISODateString(new Date());
    const cursorDate = new Date(todayStr);
    while (true) {
      const d = toISODateString(cursorDate);
      if (dateSet.has(d)) {
        current++;
        cursorDate.setDate(cursorDate.getDate() - 1);
      } else {
        break;
      }
    }

    // Walk all completed dates for longest streak
    for (let i = 0; i < sorted.length; i++) {
      if (!sorted[i].completed) continue;
      if (i === 0) {
        run = 1;
      } else {
        const prev = new Date(sorted[i - 1].log_date + "T00:00:00");
        const curr = new Date(sorted[i].log_date + "T00:00:00");
        const diff = (curr.getTime() - prev.getTime()) / 86400000;
        run = diff === 1 && sorted[i - 1].completed ? run + 1 : 1;
      }
      if (run > longest) longest = run;
    }

    return {
      completedCount: completed.length,
      longestStreak: longest,
      currentStreak: current,
    };
  }, [logs]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && closeModal()}>
      <DialogContent className="w-[95vw] max-w-2xl sm:w-full">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {habit.color && (
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ backgroundColor: habit.color }}
              />
            )}
            {habit.name} — Activity
          </DialogTitle>
        </DialogHeader>

        {/* Stat pills */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:flex sm:flex-wrap sm:gap-4">
          <div className="flex flex-col">
            <span className="text-muted-foreground text-xs">Current streak</span>
            <span className="font-semibold">
              {habit.current_streak > 0 ? habit.current_streak : currentStreak} days
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-muted-foreground text-xs">Longest streak</span>
            <span className="font-semibold">{longestStreak} days</span>
          </div>
          <div className="flex flex-col">
            <span className="text-muted-foreground text-xs">
              Completions ({WEEKS}w)
            </span>
            <span className="font-semibold">{completedCount}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-muted-foreground text-xs">30d completion rate</span>
            <span className="font-semibold">
              {Math.round(habit.completion_rate_30d * 100)}%
            </span>
          </div>
        </div>

        {/* Heatmap */}
        {isLoading ? (
          <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
            Loading activity…
          </div>
        ) : (
          <HeatmapGrid habit={habit} logs={logs} dates={dates} />
        )}

        {/* Legend */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Less</span>
          {["bg-secondary", "bg-emerald-200", "bg-emerald-300", "bg-emerald-400", "bg-emerald-500"].map(
            (cls) => (
              <div key={cls} className={`h-3.5 w-3.5 rounded-sm ${cls}`} />
            ),
          )}
          <span>More</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
