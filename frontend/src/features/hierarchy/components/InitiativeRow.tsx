"use client";

import {
  ChevronRight,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Initiative, Epic } from "@/types";
import { useInitiativeEpics } from "../hooks/useHierarchy";
import { useHierarchyStore } from "../store/hierarchy.store";
import { GoalProgressBar } from "@/features/goals/components/GoalProgressBar";
import { EpicRow } from "./EpicRow";

// ─── Initiative status badge ───────────────────────────────────────────────────

function InitiativeStatusBadge({ status }: { status: string }) {
  const CONFIG: Record<string, string> = {
    active:
      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    paused:
      "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    completed:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    abandoned: "bg-muted text-muted-foreground",
  };
  const label =
    status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        CONFIG[status] ?? "bg-secondary text-secondary-foreground",
      )}
    >
      {label}
    </span>
  );
}

// ─── Initiative row ────────────────────────────────────────────────────────────

interface InitiativeRowProps {
  initiative: Initiative;
}

export function InitiativeRow({ initiative }: InitiativeRowProps) {
  const {
    expandedInitiatives,
    toggleInitiativeExpanded,
    openEditInitiative,
    openDeleteInitiative,
    openCreateEpic,
  } = useHierarchyStore();

  const isExpanded = Boolean(expandedInitiatives[initiative.id]);

  const { data: epicsData, isLoading, isError } = useInitiativeEpics(
    initiative.id,
    isExpanded,
  );

  const epics: Epic[] = epicsData?.data ?? [];

  // Compute rollup progress from epics
  const totalItems = epics.reduce(
    (sum, e) => sum + (e.progress?.total_items ?? 0),
    0,
  );
  const doneItems = epics.reduce(
    (sum, e) => sum + (e.progress?.done_items ?? 0),
    0,
  );
  const rollupPct =
    totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;
  const totalPoints = epics.reduce((sum, e) => sum + (e.total_points ?? 0), 0);
  const donePoints = epics.reduce((sum, e) => sum + (e.done_points ?? 0), 0);

  return (
    <li>
      {/* Initiative header */}
      <div
        className="flex items-center gap-2 py-2 px-2 rounded-md hover:bg-accent/40 transition-colors cursor-pointer group/init"
        onClick={() => toggleInitiativeExpanded(initiative.id)}
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleInitiativeExpanded(initiative.id);
          }
        }}
      >
        {/* Chevron */}
        <ChevronRight
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
            isExpanded && "rotate-90",
          )}
        />

        {/* Color dot */}
        <span
          className="h-3 w-3 rounded-full shrink-0"
          style={{ background: initiative.color ?? "hsl(var(--primary))" }}
        />

        {/* Title */}
        <span className="flex-1 text-sm font-medium truncate min-w-0">
          {initiative.title}
        </span>

        {/* Status */}
        <InitiativeStatusBadge status={initiative.status} />

        {/* Epic count */}
        <Badge variant="outline" className="text-xs shrink-0">
          {epics.length} epics
        </Badge>

        {/* Progress (only when expanded and epics loaded) */}
        {isExpanded && epics.length > 0 && (
          <div className="flex items-center gap-2 shrink-0 w-36">
            <GoalProgressBar
              value={rollupPct}
              showLabel={false}
              size="sm"
            />
            <span className="text-xs text-muted-foreground tabular-nums">
              {doneItems}/{totalItems}
            </span>
          </div>
        )}

        {/* Points rollup */}
        {isExpanded && epics.length > 0 && (
          <span className="text-xs text-muted-foreground tabular-nums shrink-0 w-16 text-right">
            {donePoints}/{totalPoints}pt
          </span>
        )}

        {/* Actions */}
        <div
          className="flex items-center gap-0.5 opacity-0 group-hover/init:opacity-100 transition-opacity shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => openCreateEpic(initiative.id)}
            title="Add Epic"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <div className="relative group/initmenu">
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
            <div
              className={cn(
                "absolute right-0 top-full mt-1 z-20 w-36 rounded-md border bg-popover text-popover-foreground shadow-md",
                "opacity-0 pointer-events-none group-hover/initmenu:opacity-100 group-hover/initmenu:pointer-events-auto",
                "transition-opacity duration-100",
              )}
            >
              <div className="p-1 flex flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => openEditInitiative(initiative.id)}
                  className="flex items-center gap-2 w-full rounded px-2 py-1.5 text-sm hover:bg-accent transition-colors text-left"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => openDeleteInitiative(initiative.id)}
                  className="flex items-center gap-2 w-full rounded px-2 py-1.5 text-sm hover:bg-destructive/10 text-destructive transition-colors text-left"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Expanded epics */}
      {isExpanded && (
        <div className="ml-6 border-l border-border pl-2 mt-0.5 mb-1">
          {isLoading && (
            <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading epics...
            </div>
          )}
          {isError && (
            <div className="flex items-center gap-2 py-2 text-sm text-destructive">
              <AlertCircle className="h-3.5 w-3.5" />
              Failed to load epics
            </div>
          )}
          {!isLoading && !isError && epics.length === 0 && (
            <p className="py-2 text-xs text-muted-foreground italic">
              No epics yet.
            </p>
          )}
          {epics.length > 0 && (
            <ul className="flex flex-col gap-0.5">
              {epics.map((epic) => (
                <EpicRow key={epic.id} epic={epic} />
              ))}
            </ul>
          )}

          <Button
            variant="ghost"
            size="sm"
            className="mt-1.5 ml-0.5 gap-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => openCreateEpic(initiative.id)}
          >
            <Plus className="h-3 w-3" />
            Add epic
          </Button>
        </div>
      )}
    </li>
  );
}
