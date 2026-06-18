"use client";

import { format } from "date-fns";
import {
  ArrowRight,
  ArrowLeft,
  Loader2,
  Calendar,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { WorkItemListItem } from "@/types";
import { WorkItemStatusBadge } from "@/features/agile/components/WorkItemStatusBadge";
import { WorkItemTypeBadge } from "@/features/agile/components/WorkItemTypeBadge";

// ─── Story point pill ─────────────────────────────────────────────────────────

function PointsPill({ pts }: { pts: number | null }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded border px-1.5 min-w-[1.5rem] text-xs tabular-nums font-medium",
        pts == null
          ? "border-border text-muted-foreground"
          : "border-primary/30 bg-primary/5 text-primary",
      )}
    >
      {pts ?? "?"}
    </span>
  );
}

// ─── Backlog item row (can be moved INTO sprint) ──────────────────────────────

interface BacklogItemRowProps {
  item: WorkItemListItem;
  sprintId: string;
  isMoving: boolean;
  onMove: (itemId: string, sprintId: string) => void;
}

export function BacklogItemRow({
  item,
  sprintId,
  isMoving,
  onMove,
}: BacklogItemRowProps) {
  return (
    <div className="group flex items-center gap-2 px-3 py-2 hover:bg-accent/40 rounded-md transition-colors">
      <WorkItemTypeBadge type={item.type} />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{item.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <WorkItemStatusBadge status={item.status} className="text-[10px] py-0 h-4" />
          {item.due_date && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {format(new Date(item.due_date), "MMM d")}
            </span>
          )}
        </div>
      </div>

      <PointsPill pts={item.story_points} />

      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        onClick={() => onMove(item.id, sprintId)}
        disabled={isMoving}
        aria-label="Add to sprint"
        title="Add to sprint"
      >
        {isMoving ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <ArrowRight className="h-3.5 w-3.5" />
        )}
      </Button>
    </div>
  );
}

// ─── Sprint item row (can be moved OUT of sprint) ─────────────────────────────

interface SprintItemRowProps {
  item: WorkItemListItem;
  sprintId: string;
  isMoving: boolean;
  onRemove: (itemId: string, sprintId: string) => void;
}

export function SprintItemRow({
  item,
  sprintId,
  isMoving,
  onRemove,
}: SprintItemRowProps) {
  return (
    <div className="group flex items-center gap-2 px-3 py-2 hover:bg-accent/40 rounded-md transition-colors">
      <WorkItemTypeBadge type={item.type} />

      <div className="flex-1 min-w-0">
        <Link
          href={`/work-items/${item.id}`}
          className="text-sm font-medium truncate block hover:text-primary transition-colors"
        >
          {item.title}
        </Link>
        <div className="flex items-center gap-2 mt-0.5">
          <WorkItemStatusBadge status={item.status} className="text-[10px] py-0 h-4" />
          {item.due_date && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {format(new Date(item.due_date), "MMM d")}
            </span>
          )}
          {(item.subtask_count ?? 0) > 0 && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {item.done_subtask_count}/{item.subtask_count}
            </span>
          )}
        </div>
      </div>

      <PointsPill pts={item.story_points} />

      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        onClick={() => onRemove(item.id, sprintId)}
        disabled={isMoving}
        aria-label="Remove from sprint"
        title="Remove from sprint"
      >
        {isMoving ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <ArrowLeft className="h-3.5 w-3.5" />
        )}
      </Button>
    </div>
  );
}
