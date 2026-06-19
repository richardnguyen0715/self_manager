"use client";

import Link from "next/link";
import { format, differenceInDays, parseISO } from "date-fns";
import {
  Rocket,
  ArrowRight,
  CheckCheck,
  Layers,
  CalendarRange,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Sprint } from "@/types";

interface SprintProgressCardProps {
  sprint: Sprint;
  progressPct: number;
}

export function SprintProgressCard({
  sprint,
  progressPct,
}: SprintProgressCardProps) {
  const today = new Date();
  const endDate = parseISO(sprint.end_date);
  const startDate = parseISO(sprint.start_date);
  const totalDays = differenceInDays(endDate, startDate) + 1;
  const remainingDays = Math.max(0, differenceInDays(endDate, today) + 1);
  const elapsedPct =
    totalDays > 0
      ? Math.min(
          100,
          Math.round(((totalDays - remainingDays) / totalDays) * 100),
        )
      : 0;

  const doneCount = sprint.done_count ?? 0;
  const committedCount = sprint.committed_count ?? 0;
  const completedPoints = sprint.completed_points ?? 0;
  const plannedPoints = sprint.planned_points ?? 0;

  // Clamp displayed progress
  const displayPct = Math.min(100, Math.max(0, Math.round(progressPct)));

  const statusLabel =
    sprint.status === "active"
      ? "Active"
      : sprint.status === "planned"
        ? "Planned"
        : "Completed";

  return (
    <Card className="flex flex-col gap-0">
      <CardHeader className="pb-3 pt-5 px-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-8 w-8 rounded-md bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center shrink-0">
              <Rocket className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground font-medium">
                Active Sprint
              </p>
              <h3 className="text-sm font-semibold truncate leading-tight">
                {sprint.name}
              </h3>
            </div>
          </div>
          <Badge
            variant="secondary"
            className={cn(
              "shrink-0 text-[10px] font-semibold",
              sprint.status === "active" &&
                "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
            )}
          >
            {statusLabel}
          </Badge>
        </div>

        {sprint.goal_text && (
          <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">
            {sprint.goal_text}
          </p>
        )}
      </CardHeader>

      <CardContent className="px-5 pb-5 space-y-4">
        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Sprint progress</span>
            <span className="font-semibold tabular-nums">{displayPct}%</span>
          </div>
          <div className="h-2 rounded-full bg-secondary overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                displayPct >= 100
                  ? "bg-emerald-500"
                  : displayPct > 50
                    ? "bg-primary"
                    : "bg-violet-500",
              )}
              style={{ width: `${displayPct}%` }}
            />
          </div>
          {/* Time elapsed ghost bar */}
          <div className="h-1 rounded-full bg-secondary overflow-hidden opacity-60">
            <div
              className="h-full rounded-full bg-muted-foreground/40 transition-all duration-500"
              style={{ width: `${elapsedPct}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>Time elapsed: {elapsedPct}%</span>
            <span>{remainingDays}d remaining</span>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-md bg-muted/50 px-3 py-2 text-center">
            <p className="text-lg font-bold tabular-nums leading-tight">
              {doneCount}
            </p>
            <p className="text-[10px] text-muted-foreground">
              of {committedCount} done
            </p>
          </div>
          <div className="rounded-md bg-muted/50 px-3 py-2 text-center">
            <p className="text-lg font-bold tabular-nums leading-tight">
              {completedPoints}
            </p>
            <p className="text-[10px] text-muted-foreground">
              of {plannedPoints} pts
            </p>
          </div>
          <div className="rounded-md bg-muted/50 px-3 py-2 text-center">
            <p className="text-lg font-bold tabular-nums leading-tight">
              {remainingDays}
            </p>
            <p className="text-[10px] text-muted-foreground">days left</p>
          </div>
        </div>

        {/* Date range */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <CalendarRange className="h-3.5 w-3.5 shrink-0" />
          <span>
            {format(startDate, "MMM d")} — {format(endDate, "MMM d, yyyy")}
          </span>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button variant="outline" size="sm" className="gap-1 text-xs h-7" asChild>
            <Link href={`/sprints/${sprint.id}`}>
              <Layers className="h-3 w-3" />
              View sprint
            </Link>
          </Button>
          <Button variant="ghost" size="sm" className="gap-1 text-xs h-7" asChild>
            <Link href="/board">
              <CheckCheck className="h-3 w-3" />
              Open board
              <ArrowRight className="h-3 w-3" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function NoActiveSprintCard() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-3 py-10 text-center">
        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
          <Rocket className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium">No active sprint</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Start a sprint to see progress here.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/sprints">Manage sprints</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
