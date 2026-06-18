"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useVelocityHistory } from "../hooks/useReviews";

// ─── Bar chart (pure CSS — no external chart lib needed) ─────────────────────

interface BarProps {
  planned: number;
  completed: number;
  velocity: number;
  label: string;
  maxPoints: number;
}

function Bar({ planned, completed, velocity, label, maxPoints }: BarProps) {
  const plannedH = maxPoints > 0 ? (planned / maxPoints) * 100 : 0;
  const completedH = maxPoints > 0 ? (completed / maxPoints) * 100 : 0;
  const velocityColor =
    velocity >= 80
      ? "text-emerald-600 dark:text-emerald-400"
      : velocity >= 50
        ? "text-amber-600 dark:text-amber-400"
        : "text-red-600 dark:text-red-400";

  return (
    <div className="flex flex-col items-center gap-1 min-w-0 flex-1">
      {/* Bar area */}
      <div className="relative w-full flex items-end gap-1 h-32">
        {/* Planned bar */}
        <div
          className="flex-1 rounded-t-sm bg-secondary border border-border/50 transition-all duration-500"
          style={{ height: `${plannedH}%` }}
          title={`Planned: ${planned} pts`}
        />
        {/* Completed bar */}
        <div
          className="flex-1 rounded-t-sm bg-primary/70 transition-all duration-500"
          style={{ height: `${completedH}%` }}
          title={`Completed: ${completed} pts`}
        />
      </div>
      {/* Velocity label */}
      <span className={cn("text-xs font-semibold tabular-nums", velocityColor)}>
        {Math.round(velocity)}%
      </span>
      {/* Sprint name */}
      <span className="text-[10px] text-muted-foreground truncate w-full text-center">
        {label}
      </span>
    </div>
  );
}

// ─── Velocity chart ───────────────────────────────────────────────────────────

interface VelocityChartProps {
  /** Number of recent sprints to display. Defaults to 6. */
  last?: number;
}

/**
 * A lightweight CSS bar chart showing planned vs completed points + velocity %
 * for the last N sprints.
 *
 * Data: GET /api/sprints/velocity ?last=N
 */
export function VelocityChart({ last = 6 }: VelocityChartProps) {
  const { data, isLoading } = useVelocityHistory(last);
  const points = data?.data ?? [];

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (points.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        No velocity data yet — complete sprints to see your trend.
      </p>
    );
  }

  const maxPoints = Math.max(...points.map((p) => p.planned_points), 1);

  return (
    <div className="space-y-3">
      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-secondary border border-border/50 inline-block" />
          Planned
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-primary/70 inline-block" />
          Completed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="text-foreground font-bold text-[10px]">%</span>
          Velocity
        </span>
      </div>

      {/* Bars */}
      <div className="flex items-end gap-2 px-1">
        {points.map((pt) => (
          <Bar
            key={pt.sprint_id}
            planned={pt.planned_points}
            completed={pt.completed_points}
            velocity={pt.velocity}
            label={pt.sprint_name}
            maxPoints={maxPoints}
          />
        ))}
      </div>
    </div>
  );
}
