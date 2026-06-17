"use client";

import {
  CheckCheck,
  Timer,
  TrendingUp,
  Activity,
  Target,
  Coffee,
} from "lucide-react";
import { formatDuration } from "@/lib/utils";
import { StatCard } from "./StatCard";
import type { PeriodSummaryResponse } from "@/types";

interface KpiStripProps {
  data: PeriodSummaryResponse | undefined;
  isLoading?: boolean;
}

function LoadingCard() {
  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm animate-pulse">
      <div className="flex flex-row items-center justify-between pb-2">
        <div className="h-4 w-28 rounded bg-muted" />
        <div className="h-8 w-8 rounded-md bg-muted" />
      </div>
      <div className="h-7 w-16 rounded bg-muted mt-1" />
      <div className="h-3 w-24 rounded bg-muted mt-2" />
    </div>
  );
}

export function KpiStrip({ data, isLoading }: KpiStripProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => <LoadingCard key={i} />)}
      </div>
    );
  }

  if (!data) return null;

  const completionRate = data.avg_habit_completion_rate;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <StatCard
        title="Tasks Completed"
        value={data.tasks_completed}
        icon={CheckCheck}
        subtext={`${data.avg_tasks_completed_per_day.toFixed(1)} per day avg`}
      />
      <StatCard
        title="Tasks Created"
        value={data.tasks_created}
        icon={Target}
        subtext="in this period"
      />
      <StatCard
        title="Habit Completion"
        value={`${completionRate.toFixed(1)}%`}
        icon={TrendingUp}
        trend={
          completionRate >= 80
            ? { direction: "up", label: "On track" }
            : completionRate >= 50
              ? { direction: "neutral", label: "In progress" }
              : { direction: "down", label: "Needs attention" }
        }
      />
      <StatCard
        title="Focus Time"
        value={formatDuration(data.focus_minutes)}
        icon={Timer}
        subtext="total in period"
      />
      <StatCard
        title="Pomodoro Sessions"
        value={data.pomodoro_sessions}
        icon={Coffee}
        subtext="completed"
      />
      <StatCard
        title="Avg Tasks / Day"
        value={data.avg_tasks_completed_per_day.toFixed(1)}
        icon={Activity}
        subtext="completed per day"
      />
    </div>
  );
}
