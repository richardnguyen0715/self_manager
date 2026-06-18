"use client";

import { Loader2, AlertCircle, Plus, Rocket } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useSprints } from "@/features/agile";
import type { SprintStatus } from "@/types";

const STATUS_CONFIG: Record<SprintStatus, { label: string; className: string }> = {
  active: {
    label: "Active",
    className:
      "border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  planned: {
    label: "Planned",
    className:
      "border-transparent bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  },
  completed: {
    label: "Completed",
    className:
      "border-transparent bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  },
};

export function SprintsListView() {
  const { data, isLoading, isError } = useSprints();
  const sprints = data?.data ?? [];

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 text-muted-foreground">
        <AlertCircle className="h-6 w-6" />
        <p className="text-sm">Failed to load sprints.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {sprints.length} sprint{sprints.length !== 1 ? "s" : ""}
        </p>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" />
          New Sprint
        </Button>
      </div>

      {sprints.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3 text-muted-foreground">
          <Rocket className="h-8 w-8 opacity-40" />
          <p className="text-sm">No sprints yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">
                  Name
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">
                  Status
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">
                  Dates
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">
                  Points
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">
                  Velocity
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sprints.map((sprint) => {
                const statusCfg = STATUS_CONFIG[sprint.status];
                return (
                  <tr
                    key={sprint.id}
                    className="hover:bg-accent/40 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/sprints/${sprint.id}`}
                        className="font-medium hover:text-primary transition-colors"
                      >
                        {sprint.name}
                      </Link>
                      {sprint.goal_text && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-xs">
                          {sprint.goal_text}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={cn(statusCfg.className, "text-xs")}>
                        {statusCfg.label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                      {format(new Date(sprint.start_date), "MMM d")} –{" "}
                      {format(new Date(sprint.end_date), "MMM d, yyyy")}
                    </td>
                    <td className="px-4 py-3 text-xs tabular-nums">
                      {sprint.planned_points}/{sprint.capacity_points > 0 ? sprint.capacity_points : "∞"}
                    </td>
                    <td className="px-4 py-3 text-xs tabular-nums">
                      {sprint.velocity != null
                        ? `${Math.round(sprint.velocity)}%`
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
