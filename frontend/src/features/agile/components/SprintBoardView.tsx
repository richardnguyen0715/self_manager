"use client";

import { Loader2, AlertCircle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useActiveSprint, useSprintWorkItems } from "@/features/agile";
import { WorkItemTypeBadge } from "./WorkItemTypeBadge";
import type { WorkItemListItem, WorkItemStatus } from "@/types";
import { format } from "date-fns";

const BOARD_COLUMNS: { status: WorkItemStatus; label: string }[] = [
  { status: "todo", label: "To Do" },
  { status: "in_progress", label: "In Progress" },
  { status: "review", label: "In Review" },
  { status: "done", label: "Done" },
];

const COLUMN_HEADER_COLORS: Record<WorkItemStatus, string> = {
  todo: "border-violet-500",
  in_progress: "border-sky-500",
  review: "border-amber-500",
  done: "border-emerald-500",
  backlog: "border-slate-400",
};

export function SprintBoardView() {
  const { data: activeSprint, isLoading: sprintLoading, isError: sprintError } =
    useActiveSprint();
  const { data: itemsData, isLoading: itemsLoading } = useSprintWorkItems(
    activeSprint?.id ?? "",
  );

  if (sprintLoading || itemsLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (sprintError || !activeSprint) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-muted-foreground">
        <AlertCircle className="h-6 w-6" />
        <p className="text-sm">No active sprint.</p>
        <Button variant="outline" size="sm" asChild>
          <Link href="/sprints">View Sprints</Link>
        </Button>
      </div>
    );
  }

  const allItems = itemsData?.data ?? [];
  const byStatus = (status: WorkItemStatus): WorkItemListItem[] =>
    allItems.filter((i) => i.status === status);

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Sprint header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">{activeSprint.name}</h2>
          {activeSprint.goal_text && (
            <p className="text-sm text-muted-foreground mt-0.5">{activeSprint.goal_text}</p>
          )}
        </div>
        <Button size="sm" variant="outline" asChild>
          <Link href={`/sprints/${activeSprint.id}`}>Complete Sprint</Link>
        </Button>
      </div>

      {/* Kanban columns */}
      <div className="flex gap-4 flex-1 min-h-0 overflow-x-auto pb-4">
        {BOARD_COLUMNS.map((col) => {
          const items = byStatus(col.status);
          return (
            <div
              key={col.status}
              className="flex flex-col w-64 shrink-0 rounded-lg border bg-muted/30"
            >
              {/* Column header */}
              <div
                className={cn(
                  "px-3 py-2.5 border-b-2 flex items-center justify-between",
                  COLUMN_HEADER_COLORS[col.status],
                )}
              >
                <span className="text-xs font-semibold uppercase tracking-wide">
                  {col.label}
                </span>
                <Badge variant="secondary" className="text-xs h-5">
                  {items.length}
                </Badge>
              </div>

              {/* Cards */}
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {items.map((item) => (
                  <BoardCard key={item.id} item={item} />
                ))}
                {items.length === 0 && (
                  <div className="flex h-16 items-center justify-center text-xs text-muted-foreground">
                    No items
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BoardCard({ item }: { item: WorkItemListItem }) {
  return (
    <Link
      href={`/work-items/${item.id}`}
      className="block rounded-md border bg-card p-3 hover:border-primary/40 hover:shadow-sm transition-all"
    >
      <div className="flex items-start gap-2 mb-2">
        <WorkItemTypeBadge type={item.type} className="mt-0.5" />
        <span className="text-sm font-medium line-clamp-2 flex-1">{item.title}</span>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {item.story_points != null && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
            {item.story_points}
          </Badge>
        )}
        {item.due_date && (
          <span className="text-[10px] text-muted-foreground">
            {format(new Date(item.due_date), "MMM d")}
          </span>
        )}
      </div>
    </Link>
  );
}
