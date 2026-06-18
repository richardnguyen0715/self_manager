"use client";

import { useState } from "react";
import { Loader2, AlertCircle, Pencil, Check, X, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { Sprint } from "@/types";
import {
  useSprintReviewData,
  useUpsertReviewSummary,
} from "../hooks/useReviews";

// ─── Stat card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string | number;
  accent?: "default" | "success" | "warning" | "info";
}

function StatCard({ label, value, accent = "default" }: StatCardProps) {
  return (
    <div className="rounded-lg border bg-card px-4 py-3 flex flex-col gap-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "text-2xl font-bold tabular-nums leading-none",
          accent === "success" && "text-emerald-600 dark:text-emerald-400",
          accent === "warning" && "text-amber-600 dark:text-amber-400",
          accent === "info" && "text-sky-600 dark:text-sky-400",
        )}
      >
        {value}
      </p>
    </div>
  );
}

// ─── Velocity bar ─────────────────────────────────────────────────────────────

interface VelocityBarProps {
  velocity: number;
}

function VelocityBar({ velocity }: VelocityBarProps) {
  const pct = Math.min(Math.max(Math.round(velocity), 0), 100);
  const color =
    pct >= 80
      ? "bg-emerald-500"
      : pct >= 50
        ? "bg-amber-500"
        : "bg-red-500";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5" />
          Velocity
        </span>
        <span
          className={cn(
            "font-semibold tabular-nums",
            pct >= 80 && "text-emerald-600 dark:text-emerald-400",
            pct >= 50 && pct < 80 && "text-amber-600 dark:text-amber-400",
            pct < 50 && "text-red-600 dark:text-red-400",
          )}
        >
          {pct}%
        </span>
      </div>
      <div className="h-2.5 rounded-full bg-secondary overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", color)}
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  );
}

// ─── Summary editor ───────────────────────────────────────────────────────────

interface SummaryEditorProps {
  sprintId: string;
  initialSummary: string | null;
}

function SummaryEditor({ sprintId, initialSummary }: SummaryEditorProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialSummary ?? "");
  const upsert = useUpsertReviewSummary(sprintId);

  function handleSave() {
    upsert.mutate(
      { summary: draft.trim() || undefined },
      {
        onSuccess: () => setEditing(false),
      },
    );
  }

  function handleCancel() {
    setDraft(initialSummary ?? "");
    setEditing(false);
  }

  if (!editing) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Summary
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs gap-1"
            onClick={() => setEditing(true)}
          >
            <Pencil className="h-3 w-3" />
            Edit
          </Button>
        </div>
        {initialSummary ? (
          <p className="text-sm whitespace-pre-wrap leading-relaxed">
            {initialSummary}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            No summary yet. Click edit to add one.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Summary
      </p>
      <textarea
        autoFocus
        rows={4}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Describe what was accomplished in this sprint…"
        className={cn(
          "flex w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm",
          "placeholder:text-muted-foreground",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      />
      <div className="flex items-center gap-2 justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCancel}
          disabled={upsert.isPending}
        >
          <X className="h-3 w-3 mr-1" />
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={upsert.isPending}
        >
          {upsert.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin mr-1" />
          ) : (
            <Check className="h-3 w-3 mr-1" />
          )}
          Save
        </Button>
      </div>
      {upsert.isError && (
        <p className="text-xs text-destructive">
          {upsert.error instanceof Error
            ? upsert.error.message
            : "Failed to save summary."}
        </p>
      )}
    </div>
  );
}

// ─── Sprint Review Panel ──────────────────────────────────────────────────────

interface SprintReviewPanelProps {
  sprint: Sprint;
}

/**
 * Displays planned/completed story points, velocity %, and a summary editor
 * for a single sprint's review.
 *
 * Data: GET /api/sprints/:id/review
 * Mutation: PUT /api/sprints/:id/review  { summary? }
 */
export function SprintReviewPanel({ sprint }: SprintReviewPanelProps) {
  const { data: review, isLoading, isError } = useSprintReviewData(sprint.id);

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
        <AlertCircle className="h-5 w-5" />
        <p className="text-sm">Failed to load review data.</p>
      </div>
    );
  }

  // 404 → no review yet. Use sprint's own derived fields as a best-effort
  // display while waiting for the backend-generated review (after completion).
  const plannedPts = review?.planned_points ?? sprint.planned_points;
  const completedPts = review?.completed_points ?? sprint.completed_points;
  const velocity =
    review?.velocity ??
    (sprint.velocity != null ? sprint.velocity : null);

  // Completion % from story-point perspective
  const completionPct =
    plannedPts > 0 ? Math.round((completedPts / plannedPts) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Story point stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Planned pts"
          value={plannedPts}
          accent="info"
        />
        <StatCard
          label="Completed pts"
          value={completedPts}
          accent="success"
        />
        <StatCard
          label="Items committed"
          value={sprint.committed_count}
        />
        <StatCard
          label="Items done"
          value={sprint.done_count}
          accent={sprint.done_count >= sprint.committed_count ? "success" : "default"}
        />
      </div>

      {/* Completion progress */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Points completion</span>
          <span className="tabular-nums font-medium">
            {completedPts} / {plannedPts} pts ({completionPct}%)
          </span>
        </div>
        <div className="h-2.5 rounded-full bg-secondary overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${completionPct}%` }}
            role="progressbar"
            aria-valuenow={completionPct}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
      </div>

      {/* Velocity bar */}
      {velocity != null && (
        <VelocityBar velocity={Number(velocity)} />
      )}

      {/* No review generated yet */}
      {!review && sprint.status !== "completed" && (
        <div className="rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 px-4 py-3">
          <p className="text-sm text-amber-700 dark:text-amber-400">
            The sprint review is auto-generated when the sprint is completed.
            The figures above are live estimates from current sprint data.
          </p>
        </div>
      )}

      <Separator />

      {/* Summary editor */}
      <SummaryEditor
        sprintId={sprint.id}
        initialSummary={review?.summary ?? null}
      />
    </div>
  );
}
