"use client";

import { RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useAnalyticsStore } from "./analytics.store";
import { analyticsKeys } from "./hooks/useAnalytics";
import {
  useAnalyticsSummary,
  useAnalyticsDaily,
  useTimeUsage,
  useCompletionRate,
} from "./hooks/useAnalytics";
import { PeriodSelector } from "./components/PeriodSelector";
import { KpiStrip } from "./components/KpiStrip";
import { ProductivityChart } from "./components/ProductivityChart";
import { CompletionRateChart } from "./components/CompletionRateChart";
import { TimeUsageChart } from "./components/TimeUsageChart";
import { WeeklyReview } from "./components/WeeklyReview";
import { HabitHeatmap } from "./components/HabitHeatmap";

export function AnalyticsDashboard() {
  const { dateRange } = useAnalyticsStore();
  const queryClient = useQueryClient();

  // Backend expects `start` / `end` param names (YYYY-MM-DD)
  const queryParams = { start: dateRange.from, end: dateRange.to };

  const summaryQuery = useAnalyticsSummary(queryParams);
  const dailyQuery = useAnalyticsDaily(queryParams);
  const timeUsageQuery = useTimeUsage(queryParams);
  const completionRateQuery = useCompletionRate(queryParams);

  const isFetching =
    summaryQuery.isFetching ||
    dailyQuery.isFetching ||
    timeUsageQuery.isFetching ||
    completionRateQuery.isFetching;

  function handleRefresh() {
    void queryClient.invalidateQueries({ queryKey: analyticsKeys.all });
  }

  return (
    <div className="space-y-6">
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

      {/* Main charts — two column on wide screens */}
      <div className="grid gap-6 xl:grid-cols-2">
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
      <div className="grid gap-6 xl:grid-cols-3">
        {/* Time usage takes 1 col on xl */}
        <TimeUsageChart
          data={timeUsageQuery.data}
          isLoading={timeUsageQuery.isLoading}
        />
        {/* Daily review spans 2 cols on xl */}
        <div className="xl:col-span-2">
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
    </div>
  );
}
