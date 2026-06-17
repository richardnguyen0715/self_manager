"use client";

import { useMemo } from "react";
import { format, parseISO, eachDayOfInterval } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { DailyStatPoint } from "@/types";

interface HabitHeatmapProps {
  data: DailyStatPoint[] | undefined;
  dateRange: { from: string; to: string };
  isLoading?: boolean;
}

function intensityClass(rate: number): string {
  if (rate === 0) return "bg-muted";
  if (rate < 25) return "bg-primary/20";
  if (rate < 50) return "bg-primary/40";
  if (rate < 75) return "bg-primary/65";
  return "bg-primary";
}

function ChartSkeleton() {
  return (
    <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(14px, 1fr))" }}>
      {Array.from({ length: 35 }, (_, i) => (
        <div
          key={i}
          className="h-3.5 w-3.5 rounded-sm bg-muted animate-pulse"
        />
      ))}
    </div>
  );
}

export function HabitHeatmap({ data, dateRange, isLoading }: HabitHeatmapProps) {
  // Key data by stat_date (YYYY-MM-DD)
  const dataMap = useMemo(() => {
    const map = new Map<string, DailyStatPoint>();
    for (const d of data ?? []) {
      map.set(d.stat_date, d);
    }
    return map;
  }, [data]);

  const days = useMemo(() => {
    try {
      return eachDayOfInterval({
        start: parseISO(dateRange.from),
        end: parseISO(dateRange.to),
      });
    } catch {
      return [];
    }
  }, [dateRange.from, dateRange.to]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Habit Completion Heatmap</CardTitle>
        <p className="text-xs text-muted-foreground">
          Daily habit completion rate — darker = higher rate
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <ChartSkeleton />
        ) : days.length === 0 ? (
          <div className="flex h-20 items-center justify-center text-sm text-muted-foreground">
            No data for this period
          </div>
        ) : (
          <TooltipProvider delayDuration={200}>
            <div
              className="grid gap-1"
              style={{
                gridTemplateColumns: `repeat(auto-fill, minmax(14px, 1fr))`,
              }}
              role="grid"
              aria-label="Habit completion heatmap"
            >
              {days.map((day) => {
                const iso = format(day, "yyyy-MM-dd");
                const d = dataMap.get(iso);
                // habit_completion_rate is a percentage 0–100 from the backend
                const rate = d?.habit_completion_rate ?? 0;
                const label = format(day, "MMM d, yyyy");
                const title =
                  d
                    ? `${label} — ${Math.round(rate)}% habit completion`
                    : `${label} — no habit data`;

                return (
                  <Tooltip key={iso}>
                    <TooltipTrigger asChild>
                      <div
                        role="gridcell"
                        aria-label={title}
                        className={cn(
                          "h-3.5 w-3.5 rounded-sm transition-opacity hover:opacity-80 cursor-default",
                          intensityClass(rate),
                        )}
                      />
                    </TooltipTrigger>
                    <TooltipContent side="top">{title}</TooltipContent>
                  </Tooltip>
                );
              })}
            </div>

            {/* Legend */}
            <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>Less</span>
              {[0, 25, 50, 75, 100].map((v) => (
                <div
                  key={v}
                  className={cn("h-3 w-3 rounded-sm", intensityClass(v))}
                />
              ))}
              <span>More</span>
            </div>
          </TooltipProvider>
        )}
      </CardContent>
    </Card>
  );
}
