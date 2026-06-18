"use client";

import { useState } from "react";
import { Loader2, AlertCircle, Plus } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useWorkItems } from "@/features/agile";
import { WorkItemStatusBadge } from "./WorkItemStatusBadge";
import { WorkItemTypeBadge } from "./WorkItemTypeBadge";
import { PriorityBadge } from "@/features/tasks";
import type { WorkItemType, WorkItemStatus, Priority } from "@/types";

const TYPE_FILTER_OPTIONS: { value: WorkItemType | "all"; label: string }[] = [
  { value: "all", label: "All types" },
  { value: "story", label: "Story" },
  { value: "task", label: "Task" },
  { value: "bug", label: "Bug" },
  { value: "habit", label: "Habit" },
  { value: "milestone", label: "Milestone" },
];

const STATUS_FILTER_OPTIONS: { value: WorkItemStatus | "all"; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "backlog", label: "Backlog" },
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "review", label: "In Review" },
  { value: "done", label: "Done" },
];

export function WorkItemsListView() {
  const [typeFilter, setTypeFilter] = useState<WorkItemType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<WorkItemStatus | "all">("all");

  const { data, isLoading, isError } = useWorkItems({
    type: typeFilter !== "all" ? typeFilter : undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
  });

  const items = data?.data ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as WorkItemType | "all")}
          className="h-8 rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          {TYPE_FILTER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as WorkItemStatus | "all")}
          className="h-8 rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          {STATUS_FILTER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <span className="text-xs text-muted-foreground ml-auto">
          {total} item{total !== 1 ? "s" : ""}
        </span>

        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" />
          New Work Item
        </Button>
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : isError ? (
        <div className="flex h-64 flex-col items-center justify-center gap-2 text-muted-foreground">
          <AlertCircle className="h-6 w-6" />
          <p className="text-sm">Failed to load work items.</p>
        </div>
      ) : items.length === 0 ? (
        <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
          No work items match the current filters.
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground w-6" />
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">
                  Title
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">
                  Status
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">
                  Priority
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">
                  Points
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">
                  Due
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((item) => (
                <tr
                  key={item.id}
                  className="hover:bg-accent/40 transition-colors"
                >
                  <td className="px-4 py-3">
                    <WorkItemTypeBadge type={item.type} />
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/work-items/${item.id}`}
                      className="font-medium hover:text-primary transition-colors"
                    >
                      {item.title}
                    </Link>
                    {(item.subtask_count ?? 0) > 0 && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {item.done_subtask_count}/{item.subtask_count}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <WorkItemStatusBadge status={item.status} />
                  </td>
                  <td className="px-4 py-3">
                    <PriorityBadge priority={item.priority as Priority} />
                  </td>
                  <td className="px-4 py-3 text-xs tabular-nums text-muted-foreground">
                    {item.story_points != null ? item.story_points : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {item.due_date
                      ? format(new Date(item.due_date), "MMM d")
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
