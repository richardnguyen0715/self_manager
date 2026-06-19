"use client";

import { useState } from "react";
import { Loader2, Pencil, X, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { SprintReview } from "@/types";
import {
  useSprintReviewData,
  useUpsertSprintReview,
} from "../hooks/useSprints";

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold mt-1 tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Edit form ────────────────────────────────────────────────────────────────

interface ReviewEditFormProps {
  sprintId: string;
  existing: SprintReview;
  onCancel: () => void;
}

function ReviewEditForm({ sprintId, existing, onCancel }: ReviewEditFormProps) {
  const upsert = useUpsertSprintReview(sprintId);
  const [summary, setSummary] = useState(existing.summary ?? "");

  async function handleSave() {
    await upsert.mutateAsync({ summary: summary.trim() || undefined });
    onCancel();
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="review-summary">Sprint summary</Label>
        <textarea
          id="review-summary"
          rows={5}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="What did the team accomplish? Any learnings?"
          className="flex w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      {upsert.error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 flex items-start gap-2">
          <X className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
          <p className="text-sm text-destructive">{upsert.error.message}</p>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button size="sm" onClick={handleSave} disabled={upsert.isPending}>
          {upsert.isPending ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin mr-2" />
              Saving...
            </>
          ) : (
            "Save summary"
          )}
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

// ─── Main panel ──────────────────────────────────────────────────────────────

interface SprintReviewPanelProps {
  sprintId: string;
}

export function SprintReviewPanel({ sprintId }: SprintReviewPanelProps) {
  const { data: review, isLoading } = useSprintReviewData(sprintId);
  const [isEditing, setIsEditing] = useState(false);

  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!review) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground text-sm text-center gap-2">
        <CheckCircle2 className="h-8 w-8 opacity-30" />
        <p>No review yet.</p>
        <p className="text-xs opacity-70">
          Complete the sprint to auto-generate a review.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Planned"
          value={review.planned_points}
          sub="story points"
        />
        <StatCard
          label="Completed"
          value={review.completed_points}
          sub="story points"
        />
        <StatCard
          label="Velocity"
          value={`${Math.round(review.velocity)}%`}
          sub={
            review.completed_points >= review.planned_points
              ? "on target"
              : "below target"
          }
        />
      </div>

      {/* Velocity bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Completion</span>
          <span className="tabular-nums">
            {review.completed_points}/{review.planned_points} pts
          </span>
        </div>
        <div className="h-2 rounded-full bg-secondary overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              review.velocity >= 100
                ? "bg-emerald-500"
                : review.velocity >= 70
                  ? "bg-primary"
                  : "bg-amber-500",
            )}
            style={{
              width: `${Math.min((review.completed_points / Math.max(review.planned_points, 1)) * 100, 100)}%`,
            }}
          />
        </div>
      </div>

      {/* Summary */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold">Summary</h4>
          {!isEditing && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1"
              onClick={() => setIsEditing(true)}
            >
              <Pencil className="h-3 w-3" />
              Edit
            </Button>
          )}
        </div>

        {isEditing ? (
          <ReviewEditForm
            sprintId={sprintId}
            existing={review}
            onCancel={() => setIsEditing(false)}
          />
        ) : (
          <p
            className={cn(
              "text-sm",
              review.summary
                ? "whitespace-pre-wrap"
                : "text-muted-foreground italic",
            )}
          >
            {review.summary || "No summary written yet."}
          </p>
        )}
      </div>
    </div>
  );
}
