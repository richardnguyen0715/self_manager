"use client";

import { useSprintDashboard } from "../hooks/useSprintDashboard";
import { useSprintBurndown } from "@/features/agile";
import { SprintProgressCard, NoActiveSprintCard } from "./SprintProgressCard";
import { SprintBurndownChart } from "./SprintBurndownChart";
import { GoalProgressPanel } from "./GoalProgressPanel";
import { OverdueWorkItemsPanel } from "./OverdueWorkItemsPanel";
import { SprintHabitsPanel } from "./SprintHabitsPanel";
import { SprintDashboardSkeleton } from "./SprintDashboardSkeleton";
import { DashboardError } from "./DashboardError";

export function SprintDashboardSection() {
  const { data, isLoading, isError, error, refetch } = useSprintDashboard();

  // Burndown is only fetched when there is an active sprint
  const activeSprint = data?.active_sprint ?? null;
  const burndownQuery = useSprintBurndown(activeSprint?.id ?? "");

  if (isLoading) {
    return <SprintDashboardSkeleton />;
  }

  if (isError) {
    return (
      <DashboardError
        message={
          error instanceof Error ? error.message : "Could not load sprint data."
        }
        onRetry={() => refetch()}
      />
    );
  }

  const goalProgress = data?.goal_progress ?? [];
  const overdueItems = data?.overdue_work_items ?? [];
  const habits = data?.habits ?? [];
  const sprintProgressPct = data?.sprint_progress_pct ?? 0;

  return (
    <div className="space-y-4">
      {/* Row 1: Sprint card + Burndown */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {activeSprint ? (
          <SprintProgressCard
            sprint={activeSprint}
            progressPct={sprintProgressPct}
          />
        ) : (
          // Span the full row when there is no burndown beside it
          <div className="md:col-span-2">
            <NoActiveSprintCard />
          </div>
        )}

        {activeSprint && (
          <div>
            {burndownQuery.isLoading ? (
              <div className="rounded-lg border bg-card h-full flex items-center justify-center min-h-[160px]">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : burndownQuery.data ? (
              <SprintBurndownChart burndown={burndownQuery.data} />
            ) : null}
          </div>
        )}
      </div>

      {/* Row 2: Goal progress + Overdue work items + Habits */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <GoalProgressPanel goals={goalProgress} />
        <OverdueWorkItemsPanel items={overdueItems} />
        <SprintHabitsPanel habits={habits} />
      </div>
    </div>
  );
}
