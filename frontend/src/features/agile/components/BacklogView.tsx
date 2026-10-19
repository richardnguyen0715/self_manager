"use client";

import { EstimateBadge } from "@/features/estimate";
import { useState } from "react";
import { Loader2, AlertCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useBacklog, useSprints, useWorkItems } from "@/features/agile";
import { WorkItemStatusBadge } from "./WorkItemStatusBadge";
import { WorkItemTypeBadge } from "./WorkItemTypeBadge";
import { format } from "date-fns";
import Link from "next/link";

export function BacklogView() {
  const [sprintFilter] = useState<string | undefined>(undefined);

  const { data: backlogData, isLoading: backlogLoading, isError: backlogError } =
    useBacklog();
  const { data: sprintsData, isLoading: sprintsLoading } = useSprints();

  const sprints = sprintsData?.data ?? [];
  const backlogItems = backlogData?.data ?? [];

  if (backlogLoading || sprintsLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (backlogError) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 text-muted-foreground">
        <AlertCircle className="h-6 w-6" />
        <p className="text-sm">Failed to load backlog.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sprint sections */}
      {sprints.map((sprint) => (
        <SprintSection key={sprint.id} sprintId={sprint.id} sprintName={sprint.name} status={sprint.status} capacityPoints={sprint.capacity_points} plannedPoints={sprint.planned_points} />
      ))}

      {/* Backlog section */}
      <div className="rounded-lg border bg-card">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">Backlog</h2>
            <Badge variant="secondary" className="text-xs">
              {backlogItems.length}
            </Badge>
          </div>
          <Button size="sm" variant="ghost">
            <Plus className="h-4 w-4 mr-1" />
            Create Work Item
          </Button>
        </div>

        {backlogItems.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No items in the backlog.{" "}
            <button type="button" className="text-primary hover:underline">
              Create one
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {backlogItems.map((item) => (
              <li key={item.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/40 transition-colors">
                <WorkItemTypeBadge type={item.type} />
                <Link
                  href={`/work-items/${item.id}`}
                  className="flex-1 text-sm font-medium truncate hover:text-primary transition-colors"
                >
                  {item.title}
                </Link>
                <WorkItemStatusBadge status={item.status} />
                {item.story_points != null && (
                  <Badge variant="outline" className="text-xs tabular-nums">
                    <EstimateBadge projectId={item.project_id} value={item.story_points} />
                  </Badge>
                )}
                {item.due_date && (
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(item.due_date), "MMM d")}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

interface SprintSectionProps {
  sprintId: string;
  sprintName: string;
  status: string;
  capacityPoints: number;
  plannedPoints: number;
}

function SprintSection({ sprintId, sprintName, status, capacityPoints, plannedPoints }: SprintSectionProps) {
  const { data, isLoading } = useWorkItems({ sprint_id: sprintId });
  const items = data?.data ?? [];

  const statusColors: Record<string, string> = {
    active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    planned: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
    completed: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  };

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-sm font-semibold">{sprintName}</h2>
          <Badge
            className={cn("text-xs border-transparent", statusColors[status] ?? statusColors.planned)}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Badge>
          {capacityPoints > 0 && (
            <span className="text-xs text-muted-foreground">
              {plannedPoints}/{capacityPoints} pts
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {status === "planned" && (
            <Button size="sm" variant="ghost" asChild>
              <Link href={`/sprints/${sprintId}`}>Start Sprint</Link>
            </Button>
          )}
          {status === "active" && (
            <Button size="sm" variant="ghost" asChild>
              <Link href={`/sprints/${sprintId}`}>Complete Sprint</Link>
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-12 items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <div className="px-4 py-4 text-sm text-muted-foreground text-center">
          No items in this sprint.
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/40 transition-colors">
              <WorkItemTypeBadge type={item.type} />
              <Link
                href={`/work-items/${item.id}`}
                className="flex-1 text-sm font-medium truncate hover:text-primary transition-colors"
              >
                {item.title}
              </Link>
              <WorkItemStatusBadge status={item.status} />
              {item.story_points != null && (
                <Badge variant="outline" className="text-xs tabular-nums">
                  <EstimateBadge projectId={item.project_id} value={item.story_points} />
                </Badge>
              )}
              {item.due_date && (
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {format(new Date(item.due_date), "MMM d")}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
