"use client";

import { useState } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  useSprint,
  useSprintReview,
  useSprintRetro,
  useActivateSprint,
  useCompleteSprint,
} from "@/features/agile";

interface SprintDetailViewProps {
  sprintId: string;
}

type Tab = "overview" | "review" | "retrospective";

export function SprintDetailView({ sprintId }: SprintDetailViewProps) {
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  const { data: sprint, isLoading, isError } = useSprint(sprintId);
  const { data: review } = useSprintReview(sprintId);
  const { data: retro } = useSprintRetro(sprintId);
  const activate = useActivateSprint();
  const complete = useCompleteSprint();

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !sprint) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 text-muted-foreground">
        <AlertCircle className="h-6 w-6" />
        <p className="text-sm">Sprint not found.</p>
      </div>
    );
  }

  const progressPct =
    sprint.committed_count > 0
      ? Math.round((sprint.done_count / sprint.committed_count) * 100)
      : 0;

  const TABS: { value: Tab; label: string }[] = [
    { value: "overview", label: "Overview" },
    { value: "review", label: "Review" },
    { value: "retrospective", label: "Retrospective" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">{sprint.name}</h1>
            <Badge
              className={cn(
                "text-xs border-transparent",
                sprint.status === "active" &&
                  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
                sprint.status === "planned" &&
                  "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
                sprint.status === "completed" &&
                  "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
              )}
            >
              {sprint.status.charAt(0).toUpperCase() + sprint.status.slice(1)}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {format(new Date(sprint.start_date), "MMM d")} –{" "}
            {format(new Date(sprint.end_date), "MMM d, yyyy")}
          </p>
          {sprint.goal_text && (
            <p className="text-sm mt-1 text-foreground/80">{sprint.goal_text}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {sprint.status === "planned" && (
            <Button
              size="sm"
              onClick={() => activate.mutate(sprintId)}
              disabled={activate.isPending}
            >
              {activate.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                "Start Sprint"
              )}
            </Button>
          )}
          {sprint.status === "active" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                complete.mutate({ id: sprintId })
              }
              disabled={complete.isPending}
            >
              {complete.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                "Complete Sprint"
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Committed", value: sprint.committed_count },
          { label: "Done", value: sprint.done_count },
          {
            label: "Planned pts",
            value: `${sprint.planned_points}${sprint.capacity_points > 0 ? `/${sprint.capacity_points}` : ""}`,
          },
          {
            label: "Velocity",
            value:
              sprint.velocity != null
                ? `${Math.round(sprint.velocity)}%`
                : "—",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border bg-card px-4 py-3"
          >
            <p className="text-xs text-muted-foreground">{stat.label}</p>
            <p className="text-xl font-bold mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Sprint progress</span>
          <span>{progressPct}%</span>
        </div>
        <div className="h-2 rounded-full bg-secondary overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border flex gap-1">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setActiveTab(tab.value)}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              activeTab === tab.value
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "overview" && (
        <div className="text-sm text-muted-foreground">
          Sprint work items are shown in{" "}
          <a href="/board" className="text-primary hover:underline">
            Board view
          </a>{" "}
          or{" "}
          <a href="/backlog" className="text-primary hover:underline">
            Backlog
          </a>
          .
        </div>
      )}

      {activeTab === "review" && (
        <div className="space-y-4">
          {review ? (
            <div className="rounded-lg border bg-card p-4 space-y-3">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Planned</p>
                  <p className="font-semibold mt-0.5">{review.planned_points} pts</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Completed</p>
                  <p className="font-semibold mt-0.5">{review.completed_points} pts</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Velocity</p>
                  <p className="font-semibold mt-0.5">{Math.round(review.velocity)}%</p>
                </div>
              </div>
              {review.summary && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Summary</p>
                  <p className="text-sm">{review.summary}</p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No review yet.{" "}
              {sprint.status === "active" && "Complete the sprint to auto-generate a review."}
            </p>
          )}
        </div>
      )}

      {activeTab === "retrospective" && (
        <div className="space-y-4">
          {retro ? (
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="rounded-lg border bg-card p-4">
                <h3 className="text-sm font-semibold mb-2 text-emerald-600 dark:text-emerald-400">
                  What went well
                </h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {retro.went_well || "Nothing noted."}
                </p>
              </div>
              <div className="rounded-lg border bg-card p-4">
                <h3 className="text-sm font-semibold mb-2 text-red-600 dark:text-red-400">
                  What went wrong
                </h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {retro.went_wrong || "Nothing noted."}
                </p>
              </div>
              {retro.action_items.length > 0 && (
                <div className="sm:col-span-2 rounded-lg border bg-card p-4">
                  <h3 className="text-sm font-semibold mb-2">Action Items</h3>
                  <ul className="space-y-1">
                    {retro.action_items.map((ai) => (
                      <li key={ai.id} className="flex items-start gap-2 text-sm">
                        <span
                          className={cn(
                            "h-4 w-4 rounded border border-input flex items-center justify-center shrink-0 mt-0.5",
                            ai.done && "bg-emerald-500 border-emerald-500 text-white",
                          )}
                        >
                          {ai.done && "✓"}
                        </span>
                        <span className={cn(ai.done && "line-through text-muted-foreground")}>
                          {ai.text}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No retrospective yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
