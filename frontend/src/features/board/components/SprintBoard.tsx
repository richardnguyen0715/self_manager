"use client";

import Link from "next/link";
import { format } from "date-fns";
import {
  AlertCircle,
  Loader2,
  RefreshCw,
  CalendarRange,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useActiveSprint, useBoardItems } from "../hooks/useSprintBoard";
import { useBoardStore } from "../store";
import { useProjectStore } from "@/stores";
import { SprintBoardDnd } from "./SprintBoardDnd";
import { WorkItemDetailSheet } from "./WorkItemDetailSheet";
import { BoardFilters } from "./BoardFilters";

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
  const { data: activeSprint } = useActiveSprint();
  const currentProjectId = useProjectStore((s) => s.currentProjectId);

  const {
    isLoading: itemsLoading,
    isError: itemsError,
    refetch: refetchItems,
  } = useBoardItems(currentProjectId);

  const { columns, openItemId } = useBoardStore();

  // ── Loading ──────────────────────────────────────────────────────────────

  if (itemsLoading) {
    return (
      <div className="flex h-64 items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Loading board…</span>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────

  if (itemsError) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-muted-foreground">
        <AlertCircle className="h-6 w-6" />
        <p className="text-sm">Failed to load the board.</p>
        <Button variant="outline" size="sm" onClick={() => refetchItems()}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Retry
        </Button>
      </div>
    );
  }

  // ── Derived stats ────────────────────────────────────────────────────────

  const allItems = columns.flatMap((c) => c.items ?? []);
  const totalCount = allItems.length;
  // "Done" is the column whose mapped_status = "done" (seeded default)
  const doneCount = (
    columns.find((c) => c.mapped_status === "done")?.items ?? []
  ).length;

  return (
    <div className="flex flex-col h-full gap-4 min-h-0">
      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3 shrink-0">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold leading-tight">
              {activeSprint ? activeSprint.name : "All work items"}
            </h2>
            {activeSprint && (
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
            )}
          </div>
          {activeSprint && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <CalendarRange className="h-3 w-3" />
              {format(new Date(activeSprint.start_date), "MMM d")} –{" "}
              {format(new Date(activeSprint.end_date), "MMM d, yyyy")}
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            <span className="font-medium text-foreground">{doneCount}</span>
            <span>/</span>
            <span>{totalCount} items</span>
            <SprintProgressBar doneCount={doneCount} totalCount={totalCount} />
          </div>
          {activeSprint && (
            <Button size="sm" variant="outline" asChild>
              <Link href={`/sprints/${activeSprint.id}`}>Sprint detail</Link>
            </Button>
          )}
        </div>
      </div>

      {/* ── Filters ─────────────────────────────────────────────────────────── */}
      <BoardFilters />

      {/* ── Kanban columns ─────────────────────────────────────────────────── */}
      <ScrollArea className="flex-1 min-h-0">
        <SprintBoardDnd sprintId={activeSprint?.id ?? ""} />
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* ── Work item detail slide-over ─────────────────────────────────── */}
      {openItemId && <WorkItemDetailSheet sprintId={activeSprint?.id ?? ""} />}
    </div>
  );
}
