"use client";

import { RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useAnalyticsStore } from "./analytics.store";
import { analyticsKeys } from "./hooks/useAnalytics";
import {
  useAnalyticsSummary,
  useAnalyticsDaily,
  useTimeUsage,
  useCompletionRate,
} from "./hooks/useAnalytics";
import {
  useSprintVelocity,
  useTimeByEpic,
  useAnalyticsSprintList,
  agileAnalyticsKeys,
} from "./hooks/useAgileAnalytics";
import { PeriodSelector } from "./components/PeriodSelector";
import { KpiStrip } from "./components/KpiStrip";
import { ProductivityChart } from "./components/ProductivityChart";
import { CompletionRateChart } from "./components/CompletionRateChart";
import { TimeUsageChart } from "./components/TimeUsageChart";
import { WeeklyReview } from "./components/WeeklyReview";
import { HabitHeatmap } from "./components/HabitHeatmap";
import { SprintVelocityChart } from "./components/SprintVelocityChart";
import { BurndownChart } from "./components/BurndownChart";
import { TimeByEpicChart } from "./components/TimeByEpicChart";

export function AnalyticsDashboard() {
  const { dateRange } = useAnalyticsStore();
  const queryClient = useQueryClient();

  // Backend expects `start` / `end` param names (YYYY-MM-DD)
  const queryParams = { start: dateRange.from, end: dateRange.to };

  const summaryQuery = useAnalyticsSummary(queryParams);
  const dailyQuery = useAnalyticsDaily(queryParams);
  const timeUsageQuery = useTimeUsage(queryParams);
  const completionRateQuery = useCompletionRate(queryParams);

  // Agile analytics — period-scoped where applicable
  const velocityQuery = useSprintVelocity(6);
  const timeByEpicQuery = useTimeByEpic(queryParams);
  const sprintListQuery = useAnalyticsSprintList();

  const isFetching =
    summaryQuery.isFetching ||
    dailyQuery.isFetching ||
    timeUsageQuery.isFetching ||
    completionRateQuery.isFetching ||
    velocityQuery.isFetching ||
    timeByEpicQuery.isFetching;

  function handleRefresh() {
    void queryClient.invalidateQueries({ queryKey: analyticsKeys.all });
    void queryClient.invalidateQueries({ queryKey: agileAnalyticsKeys.all });
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header row: period picker + refresh */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PeriodSelector />
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isFetching}
          className="self-start sm:self-auto"
          aria-label="Refresh analytics"
        >
          <RefreshCw
            className={isFetching ? "animate-spin" : ""}
            aria-hidden
          />
          Refresh
        </Button>
      </div>

      {/* KPI strip */}
      <KpiStrip
        data={summaryQuery.data}
        isLoading={summaryQuery.isLoading}
      />

      {/* Error banner */}
      {(summaryQuery.isError ||
        dailyQuery.isError ||
        timeUsageQuery.isError ||
        completionRateQuery.isError) && (
        <div
          role="alert"
          className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          Failed to load some analytics data. Check your connection and try
          refreshing.
        </div>
      )}

      {/* Main charts — two column on large screens */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ProductivityChart
          data={dailyQuery.data}
          isLoading={dailyQuery.isLoading}
        />
        <CompletionRateChart
          data={completionRateQuery.data}
          isLoading={completionRateQuery.isLoading}
        />
      </div>

      {/* Second row */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Time usage takes 1 col on lg */}
        <TimeUsageChart
          data={timeUsageQuery.data}
          isLoading={timeUsageQuery.isLoading}
        />
        {/* Daily review spans 2 cols on lg */}
        <div className="lg:col-span-2">
          <WeeklyReview
            data={dailyQuery.data}
            isLoading={dailyQuery.isLoading}
          />
        </div>
      </div>

      {/* Habit heatmap — full width */}
      <HabitHeatmap
        data={dailyQuery.data}
        dateRange={dateRange}
        isLoading={dailyQuery.isLoading}
      />

      {/* ── Sprint / Agile analytics ─────────────────────────────────── */}
      <Separator />

      <div>
        <h2 className="text-sm font-semibold text-foreground mb-1">
          Sprint Analytics
        </h2>
        <p className="text-xs text-muted-foreground">
          Velocity, burndown, and focus time per epic
        </p>
      </div>

      {/* Velocity + time-by-epic side by side on large screens */}
      <div className="grid gap-6 lg:grid-cols-2">
        <SprintVelocityChart
          data={velocityQuery.data}
          isLoading={velocityQuery.isLoading}
        />
        <TimeByEpicChart
          data={timeByEpicQuery.data}
          isLoading={timeByEpicQuery.isLoading}
        />
      </div>

      {/* Burndown — full width (needs sprint picker) */}
      <BurndownChart
        sprintsData={sprintListQuery.data}
        sprintsLoading={sprintListQuery.isLoading}
      />
    </div>
  );
}
