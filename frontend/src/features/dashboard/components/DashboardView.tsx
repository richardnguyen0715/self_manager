"use client";

import { useDashboardSummary } from "../hooks/useDashboardSummary";
import { DashboardGreeting } from "./DashboardGreeting";
import { GetStartedCard } from "./GetStartedCard";
import { StatCards } from "./StatCards";
import { StatCardsSkeleton } from "./StatCardsSkeleton";
import { TodayPanel } from "./TodayPanel";
import { TodayPanelSkeleton } from "./TodayPanelSkeleton";
import { DashboardError } from "./DashboardError";
import { SprintDashboardSection } from "./SprintDashboardSection";
import { Separator } from "@/components/ui/separator";

export function DashboardView() {
  const { data, isLoading, isError, error, refetch } = useDashboardSummary();

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Greeting row */}
      <DashboardGreeting />

      {/* Onboarding checklist — only for empty workspaces */}
      <GetStartedCard />

      {/* ── Sprint-centric section ─────────────────────────────────────── */}
      <SprintDashboardSection />

      <Separator />

      {/* ── Legacy daily summary ───────────────────────────────────────── */}
      {/* Stat cards row */}
      {isLoading ? (
        <StatCardsSkeleton />
      ) : isError ? (
        <DashboardError
          message={
            error instanceof Error ? error.message : "Could not load stats."
          }
          onRetry={() => refetch()}
        />
      ) : data ? (
        <StatCards stats={data.stats} />
      ) : null}

      {/* Today panel */}
      {isLoading ? (
        <TodayPanelSkeleton />
      ) : data ? (
        <TodayPanel summary={data} />
      ) : null}
    </div>
  );
}
