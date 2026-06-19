"use client";

import { useState } from "react";
import { format } from "date-fns";
import {
  Loader2,
  AlertCircle,
  ArrowLeft,
  Play,
  CheckCircle2,
  Pencil,
  Calendar,
  Target,
  ListChecks,
  BarChart2,
  ClipboardCheck,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { SprintDetailTab } from "../types";
import {
  useSprintDetail,
  useActivateSprint,
} from "../hooks/useSprints";
import { useSprintUIStore } from "../store";
import { SprintStatusBadge } from "./SprintStatusBadge";
import { CapacityBar } from "./CapacityBar";
import { SprintPlanningPanel } from "./SprintPlanningPanel";
import { BurndownChart } from "./BurndownChart";
import { SprintReviewPanel } from "./SprintReviewPanel";
import { RetrospectivePanel } from "./RetrospectivePanel";
import { SprintWorkItemsOverview } from "./SprintWorkItemsOverview";
import { SprintDialog } from "./SprintDialog";
import { CompleteSprintDialog } from "./CompleteSprintDialog";

// ─── Tab definitions ──────────────────────────────────────────────────────────

const TABS: { value: SprintDetailTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "overview", label: "Overview", icon: ListChecks },
  { value: "planning", label: "Planning", icon: Target },
  { value: "burndown", label: "Burndown", icon: BarChart2 },
  { value: "review", label: "Review", icon: ClipboardCheck },
  { value: "retrospective", label: "Retrospective", icon: RefreshCw },
];

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card px-4 py-3",
        highlight && "border-primary/20 bg-primary/5",
      )}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-bold mt-1 tabular-nums">{value}</p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface SprintDetailProps {
  sprintId: string;
}

export function SprintDetail({ sprintId }: SprintDetailProps) {
  const [activeTab, setActiveTab] = useState<SprintDetailTab>("overview");

  const { data: sprint, isLoading, isError } = useSprintDetail(sprintId);
  const activate = useActivateSprint();
  const { openEditDialog, openCompleteDialog } = useSprintUIStore();

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !sprint) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-muted-foreground">
        <AlertCircle className="h-8 w-8" />
        <p className="text-sm font-medium">Sprint not found.</p>
        <Link href="/sprints">
          <Button variant="outline" size="sm" className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Back to sprints
          </Button>
        </Link>
      </div>
    );
  }

  const progressPct =
    sprint.committed_count > 0
      ? Math.round((sprint.done_count / sprint.committed_count) * 100)
      : 0;

  return (
    <div className="space-y-6">
      {/* ── Breadcrumb ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link
          href="/sprints"
          className="hover:text-foreground transition-colors"
        >
          Sprints
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">{sprint.name}</span>
      </div>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold">{sprint.name}</h1>
            <SprintStatusBadge status={sprint.status} />
          </div>

          <div className="flex items-center gap-3 mt-1.5 text-sm text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {format(new Date(sprint.start_date), "MMM d")} –{" "}
              {format(new Date(sprint.end_date), "MMM d, yyyy")}
            </span>
          </div>

          {sprint.goal_text && (
            <p className="text-sm text-foreground/80 mt-1.5 max-w-lg">
              {sprint.goal_text}
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => openEditDialog(sprintId)}
            title="Edit sprint"
          >
            <Pencil className="h-4 w-4" />
          </Button>

          {sprint.status === "planned" && (
            <Button
              size="sm"
              onClick={() => activate.mutate(sprintId)}
              disabled={activate.isPending}
              className="gap-1.5"
            >
              {activate.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
              Start Sprint
            </Button>
          )}

          {sprint.status === "active" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => openCompleteDialog(sprintId)}
              className="gap-1.5"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Complete Sprint
            </Button>
          )}
        </div>
      </div>

      {/* ── Stats row ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Committed" value={sprint.committed_count} />
        <StatCard
          label="Done"
          value={sprint.done_count}
          highlight={sprint.done_count === sprint.committed_count && sprint.committed_count > 0}
        />
        <StatCard
          label="Points"
          value={`${sprint.planned_points}${sprint.capacity_points > 0 ? `/${sprint.capacity_points}` : ""}`}
        />
        <StatCard
          label="Velocity"
          value={
            sprint.velocity != null
              ? `${Math.round(sprint.velocity)}%`
              : "—"
          }
        />
      </div>

      {/* ── Progress bar ─────────────────────────────────────────────────── */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Sprint progress</span>
          <span className="tabular-nums">{progressPct}%</span>
        </div>
        <div className="h-2 rounded-full bg-secondary overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* ── Capacity bar (only if capacity is set) ────────────────────── */}
      {sprint.capacity_points > 0 && (
        <CapacityBar
          planned={sprint.planned_points}
          capacity={sprint.capacity_points}
        />
      )}

      <Separator />

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-0.5 border-b border-border overflow-x-auto">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveTab(tab.value)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap",
                activeTab === tab.value
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Tab content ──────────────────────────────────────────────────── */}
      {activeTab === "overview" && (
        <SprintWorkItemsOverview sprintId={sprintId} sprint={sprint} />
      )}

      {activeTab === "planning" && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Pick backlog items into this sprint. Items with story points count
            toward capacity. The backend enforces the capacity cap (409 on
            overflow).
          </p>
          <SprintPlanningPanel sprintId={sprintId} />
        </div>
      )}

      {activeTab === "burndown" && <BurndownChart sprintId={sprintId} />}

      {activeTab === "review" && <SprintReviewPanel sprintId={sprintId} />}

      {activeTab === "retrospective" && (
        <RetrospectivePanel sprintId={sprintId} />
      )}

      {/* Dialogs */}
      <SprintDialog />
      <CompleteSprintDialog />
    </div>
  );
}
