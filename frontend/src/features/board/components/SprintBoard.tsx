"use client";

import Link from "next/link";
import { format, differenceInDays } from "date-fns";
import {
  AlertCircle,
  Loader2,
  RefreshCw,
  Zap,
  CalendarRange,
  BarChart2,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useActiveSprint, useSprintBoard } from "../hooks/useSprintBoard";
import { useBoardStore } from "../store";
import { SprintBoardDnd } from "./SprintBoardDnd";
import { WorkItemDetailSheet } from "./WorkItemDetailSheet";

// ─── Sprint progress summary bar ─────────────────────────────────────────────

function SprintProgressBar({
  doneCount,
  totalCount,
}: {
  doneCount: number;
  totalCount: number;
}) {
  const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
  return (
    <div className="flex items-center gap-2 min-w-[6rem]">
      <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden min-w-[4rem]">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
        {doneCount}/{totalCount}
      </span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SprintBoard() {
  const {
    data: activeSprint,
    isLoading: sprintLoading,
    isError: sprintError,
    refetch: refetchSprint,
  } = useActiveSprint();

  const {
    isLoading: itemsLoading,
    isError: itemsError,
    refetch: refetchItems,
  } = useSprintBoard(activeSprint?.id ?? "");

  const { columns, openItemId } = useBoardStore();

  // ── Loading ──────────────────────────────────────────────────────────────

  if (sprintLoading || (activeSprint && itemsLoading)) {
    return (
      <div className="flex h-64 items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Loading board…</span>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────

  if (sprintError || itemsError) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-muted-foreground">
        <AlertCircle className="h-6 w-6" />
        <p className="text-sm">Failed to load the board.</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            refetchSprint();
            refetchItems();
          }}
        >
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Retry
        </Button>
      </div>
    );
  }

  // ── No active sprint ─────────────────────────────────────────────────────

  if (!activeSprint) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-muted-foreground">
        <Zap className="h-8 w-8 opacity-40" />
        <p className="text-sm font-medium">No active sprint</p>
        <p className="text-xs text-center max-w-xs">
          Start a sprint from the Backlog or Sprints page to see work items on the
          board.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/backlog">Go to Backlog</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/sprints">Go to Sprints</Link>
          </Button>
        </div>
      </div>
    );
  }

  // ── Derived stats ────────────────────────────────────────────────────────

  const allItems = columns.flatMap((c) => c.items ?? []);
  const totalCount = allItems.length;
  const doneCount = (columns.find((c) => c.status === "done")?.items ?? []).length;
  const daysLeft = differenceInDays(
    new Date(activeSprint.end_date),
    new Date(),
  );
  const daysLeftLabel =
    daysLeft < 0
      ? "Overdue"
      : daysLeft === 0
        ? "Last day"
        : `${daysLeft}d left`;

  const plannedPoints = activeSprint.planned_points ?? 0;
  const donePoints = activeSprint.completed_points ?? 0;

  return (
    <div className="flex flex-col h-full gap-4 min-h-0">
      {/* ── Sprint header ───────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3 shrink-0">
        <div className="flex flex-col gap-0.5">
          {/* Sprint name + status badge */}
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold leading-tight">
              {activeSprint.name}
            </h2>
            <Badge
              variant="secondary"
              className={cn(
                "text-[10px] px-1.5 py-0 h-4 font-medium uppercase tracking-wide",
                activeSprint.status === "active" &&
                  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
              )}
            >
              {activeSprint.status}
            </Badge>
          </div>

          {/* Dates + sprint goal */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <CalendarRange className="h-3 w-3" />
              {format(new Date(activeSprint.start_date), "MMM d")} –{" "}
              {format(new Date(activeSprint.end_date), "MMM d, yyyy")}
            </span>
            <span
              className={cn(
                "text-xs font-medium",
                daysLeft < 0
                  ? "text-destructive"
                  : daysLeft <= 2
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-muted-foreground",
              )}
            >
              {daysLeftLabel}
            </span>
            {activeSprint.goal_text && (
              <span className="text-xs text-muted-foreground italic truncate max-w-xs">
                {activeSprint.goal_text}
              </span>
            )}
          </div>
        </div>

        {/* Right: stats + complete sprint */}
        <div className="flex items-center gap-4">
          {/* Done/Total */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            <span className="font-medium text-foreground">{doneCount}</span>
            <span>/</span>
            <span>{totalCount} items</span>
            <SprintProgressBar doneCount={doneCount} totalCount={totalCount} />
          </div>

          {/* Points */}
          {plannedPoints > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <BarChart2 className="h-3.5 w-3.5" />
              <span className="font-medium text-foreground">{donePoints}</span>
              <span>/</span>
              <span>{plannedPoints} pts</span>
            </div>
          )}

          {/* Complete sprint */}
          <Button size="sm" variant="outline" asChild>
            <Link href={`/sprints/${activeSprint.id}`}>Complete sprint</Link>
          </Button>
        </div>
      </div>

      {/* ── Kanban columns ─────────────────────────────────────────────────── */}
      <ScrollArea className="flex-1 min-h-0">
        <SprintBoardDnd sprintId={activeSprint.id} />
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* ── Work item detail slide-over ─────────────────────────────────── */}
      {openItemId && <WorkItemDetailSheet sprintId={activeSprint.id} />}
    </div>
  );
}
