"use client";

import { format, differenceInDays } from "date-fns";
import {
  Loader2,
  AlertCircle,
  Plus,
  Rocket,
  MoreHorizontal,
  Pencil,
  Trash2,
  Play,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { Sprint, SprintStatus } from "@/types";
import { useSprintsList, useActivateSprint, useDeleteSprint } from "../hooks/useSprints";
import { useSprintUIStore } from "../store";
import { useProjectStore } from "@/stores";
import { SprintStatusBadge } from "./SprintStatusBadge";
import { CapacityBar } from "./CapacityBar";
import { SprintDialog } from "./SprintDialog";
import { CompleteSprintDialog } from "./CompleteSprintDialog";

// ─── Skeleton row ─────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 px-4 py-3 animate-pulse">
      <div className="h-4 bg-muted rounded w-40" />
      <div className="h-5 bg-muted rounded w-16" />
      <div className="h-4 bg-muted rounded w-28 ml-auto" />
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ filtered }: { filtered: boolean }) {
  const { openCreateDialog } = useSprintUIStore();
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <Rocket className="h-10 w-10 text-muted-foreground/40 mb-3" />
      <p className="text-sm font-medium">
        {filtered ? "No sprints match your filter" : "No sprints yet"}
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        {filtered
          ? "Try a different status filter."
          : "Create your first sprint to start planning."}
      </p>
      {!filtered && (
        <Button size="sm" className="mt-4 gap-1.5" onClick={openCreateDialog}>
          <Plus className="h-4 w-4" />
          Create sprint
        </Button>
      )}
    </div>
  );
}

// ─── Sprint row ───────────────────────────────────────────────────────────────

interface SprintRowProps {
  sprint: Sprint;
}

function SprintRow({ sprint }: SprintRowProps) {
  const activate = useActivateSprint();
  const deleteSprint = useDeleteSprint();
  const { openEditDialog, openCompleteDialog } = useSprintUIStore();

  const daysLeft =
    sprint.status === "active"
      ? differenceInDays(new Date(sprint.end_date), new Date())
      : null;

  function handleDelete() {
    if (confirm(`Delete "${sprint.name}"? This cannot be undone.`)) {
      deleteSprint.mutate(sprint.id);
    }
  }

  return (
    <div className="group relative flex items-start gap-3 px-4 py-3 hover:bg-accent/40 transition-colors rounded-lg">
      {/* Left: name + goal text */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={`/sprints/${sprint.id}`}
            className="font-medium hover:text-primary transition-colors text-sm"
          >
            {sprint.name}
          </Link>
          <SprintStatusBadge status={sprint.status} />
          {daysLeft !== null && (
            <span
              className={cn(
                "text-xs tabular-nums",
                daysLeft < 0
                  ? "text-destructive font-medium"
                  : daysLeft <= 2
                    ? "text-amber-600 dark:text-amber-400 font-medium"
                    : "text-muted-foreground",
              )}
            >
              {daysLeft < 0
                ? `${Math.abs(daysLeft)}d overdue`
                : daysLeft === 0
                  ? "ends today"
                  : `${daysLeft}d left`}
            </span>
          )}
        </div>

        {sprint.goal_text && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-sm">
            {sprint.goal_text}
          </p>
        )}

        {/* Dates */}
        <p className="text-xs text-muted-foreground mt-1">
          {format(new Date(sprint.start_date), "MMM d")} –{" "}
          {format(new Date(sprint.end_date), "MMM d, yyyy")}
        </p>
      </div>

      {/* Capacity bar */}
      <div className="w-44 shrink-0">
        <CapacityBar
          planned={sprint.planned_points}
          capacity={sprint.capacity_points}
        />
        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
          <span className="tabular-nums">
            {sprint.done_count}/{sprint.committed_count} done
          </span>
          {sprint.velocity != null && (
            <span className="tabular-nums">
              {Math.round(sprint.velocity)}% velocity
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {sprint.status === "planned" && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => activate.mutate(sprint.id)}
            disabled={activate.isPending}
          >
            {activate.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <>
                <Play className="h-3 w-3 mr-1" />
                Start
              </>
            )}
          </Button>
        )}

        {sprint.status === "active" && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => openCompleteDialog(sprint.id)}
          >
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Complete
          </Button>
        )}

        <Link href={`/sprints/${sprint.id}`}>
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </Link>

        <DropdownMenuPrimitive.Root>
          <DropdownMenuPrimitive.Trigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuPrimitive.Trigger>
          <DropdownMenuPrimitive.Portal>
            <DropdownMenuPrimitive.Content
              align="end"
              sideOffset={4}
              className={cn(
                "z-50 min-w-[10rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md",
                "data-[state=open]:animate-in data-[state=closed]:animate-out",
                "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
                "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
                "data-[side=bottom]:slide-in-from-top-2",
              )}
            >
              <DropdownMenuPrimitive.Item
                onSelect={() => openEditDialog(sprint.id)}
                className="flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none gap-2 focus:bg-accent focus:text-accent-foreground"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </DropdownMenuPrimitive.Item>
              <DropdownMenuPrimitive.Separator className="my-1 h-px bg-border" />
              <DropdownMenuPrimitive.Item
                onSelect={handleDelete}
                className="flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none gap-2 focus:bg-destructive/10 focus:text-destructive text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </DropdownMenuPrimitive.Item>
            </DropdownMenuPrimitive.Content>
          </DropdownMenuPrimitive.Portal>
        </DropdownMenuPrimitive.Root>
      </div>
    </div>
  );
}

// ─── Status section ───────────────────────────────────────────────────────────

interface StatusSectionProps {
  status: SprintStatus;
  sprints: Sprint[];
}

const SECTION_LABELS: Record<SprintStatus, string> = {
  active: "Active Sprint",
  planned: "Planned",
  completed: "Completed",
};

function StatusSection({ status, sprints }: StatusSectionProps) {
  if (sprints.length === 0) return null;
  return (
    <div className="space-y-1">
      <div className="px-4 py-2 flex items-center gap-2">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {SECTION_LABELS[status]}
        </span>
        <span className="text-xs text-muted-foreground">({sprints.length})</span>
      </div>
      <div className="rounded-lg border overflow-hidden">
        {sprints.map((s, idx) => (
          <div key={s.id}>
            <SprintRow sprint={s} />
            {idx < sprints.length - 1 && <Separator />}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main list ────────────────────────────────────────────────────────────────

export function SprintsList() {
  const { filters, openCreateDialog } = useSprintUIStore();
  const { currentProjectId } = useProjectStore();
  const { data, isLoading, isError, error } = useSprintsList(
    currentProjectId != null
      ? { ...filters, project_id: currentProjectId }
      : filters,
  );

  const allSprints = data?.data ?? [];
  const total = data?.total ?? 0;

  const hasFilter = filters.status && filters.status !== "all";

  const activeSprints = allSprints.filter((s) => s.status === "active");
  const plannedSprints = allSprints.filter((s) => s.status === "planned");
  const completedSprints = allSprints.filter((s) => s.status === "completed");

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold">Sprints</h1>
          {total > 0 && (
            <span className="text-sm text-muted-foreground tabular-nums">
              ({total})
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Status filter */}
          <select
            value={filters.status ?? "all"}
            onChange={(e) =>
              useSprintUIStore
                .getState()
                .setFilter("status", e.target.value as SprintStatus | "all")
            }
            className="h-8 rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="planned">Planned</option>
            <option value="completed">Completed</option>
          </select>

          <Button onClick={openCreateDialog} size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" />
            New sprint
          </Button>
        </div>
      </div>

      {isError ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
          <AlertCircle className="h-8 w-8" />
          <p className="text-sm font-medium text-destructive">
            Failed to load sprints
          </p>
          <p className="text-xs">{(error as Error)?.message}</p>
        </div>
      ) : isLoading ? (
        <div className="rounded-lg border">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={i > 0 ? "border-t" : ""}>
              <SkeletonRow />
            </div>
          ))}
        </div>
      ) : allSprints.length === 0 ? (
        <EmptyState filtered={Boolean(hasFilter)} />
      ) : (
        <div className="space-y-6">
          <StatusSection status="active" sprints={activeSprints} />
          <StatusSection status="planned" sprints={plannedSprints} />
          <StatusSection status="completed" sprints={completedSprints} />
        </div>
      )}

      {/* Dialogs */}
      <SprintDialog />
      <CompleteSprintDialog />
    </div>
  );
}
