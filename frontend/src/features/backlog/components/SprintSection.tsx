"use client";

/**
 * SprintSection — one sprint band in the backlog view.
 * Matches the Jira backlog pattern:
 *   [v] Sprint Name  <dates>  (<N> work items)   [0 | 0 | 0]  [Start sprint / Complete sprint]  [...]
 *   row row row ...
 *   [+ Create]
 *
 * Endpoints:
 *   GET /api/sprints/:id/work-items  → { data: WorkItemListItem[], total }
 *   POST /api/sprints/:id/activate
 *   POST /api/sprints/:id/complete
 */

import { useState } from "react";
import { format } from "date-fns";
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  MoreHorizontal,
  Rocket,
  CheckCircle2,
  Link as LinkIcon,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Sprint, WorkItemListItem } from "@/types";
import {
  useSprintWorkItems,
  useActivateSprint,
  useCompleteSprint,
} from "@/features/agile";
import { useDroppable } from "@dnd-kit/core";
import { useBacklogStore } from "../store/useBacklogStore";
import { WorkItemRow } from "./WorkItemRow";
import { QuickAddRow } from "./QuickAddRow";
import type { BacklogFiltersState } from "../store/useBacklogStore";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SPRINT_STATUS_CLASS: Record<string, string> = {
  active:
    "bg-emerald-100 text-emerald-700 border-transparent dark:bg-emerald-900/30 dark:text-emerald-400",
  planned:
    "bg-violet-100 text-violet-700 border-transparent dark:bg-violet-900/30 dark:text-violet-400",
  completed:
    "bg-slate-100 text-slate-600 border-transparent dark:bg-slate-800 dark:text-slate-400",
};

function applyFilters(
  items: WorkItemListItem[],
  filters: BacklogFiltersState,
): WorkItemListItem[] {
  return items.filter((item) => {
    if (filters.type !== "all" && item.type !== filters.type) return false;
    if (filters.priority !== "all" && item.priority !== filters.priority)
      return false;
    if (filters.epic_id !== "all" && item.epic_id !== filters.epic_id)
      return false;
    if (
      filters.search &&
      !item.title.toLowerCase().includes(filters.search.toLowerCase())
    )
      return false;
    return true;
  });
}

// ─── Done / In Progress / To Do badge counts ──────────────────────────────────

function SprintStats({
  items,
}: {
  items: WorkItemListItem[];
}) {
  const todo = items.filter(
    (i) => i.status === "todo" || i.status === "backlog",
  ).length;
  const inProgress = items.filter((i) => i.status === "in_progress" || i.status === "review").length;
  const done = items.filter((i) => i.status === "done").length;

  return (
    <div className="flex items-center gap-1 text-xs">
      <span
        title="To do"
        className="min-w-[1.25rem] h-5 rounded px-1 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 tabular-nums text-center"
      >
        {todo}
      </span>
      <span
        title="In progress"
        className="min-w-[1.25rem] h-5 rounded px-1 bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400 tabular-nums text-center"
      >
        {inProgress}
      </span>
      <span
        title="Done"
        className="min-w-[1.25rem] h-5 rounded px-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 tabular-nums text-center"
      >
        {done}
      </span>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface SprintSectionProps {
  sprint: Sprint;
  allSprints: Sprint[];
}

export function SprintSection({ sprint, allSprints }: SprintSectionProps) {
  const { collapsedSprints, toggleSprintCollapse, filters, openCreateItem } =
    useBacklogStore();
  const isCollapsed = Boolean(collapsedSprints[sprint.id]);

  const { setNodeRef: dropRef, isOver } = useDroppable({
    id: `sprint-${sprint.id}`,
    data: { type: "sprint-drop", sprintId: sprint.id },
  });

  const { data, isLoading } = useSprintWorkItems(sprint.id);
  const activateSprint = useActivateSprint();
  const completeSprint = useCompleteSprint();
  const [completing, setCompleting] = useState(false);

  const rawItems: WorkItemListItem[] = data?.data ?? [];
  const filtered = applyFilters(rawItems, filters);

  const dateRange =
    sprint.start_date && sprint.end_date
      ? `${format(new Date(sprint.start_date), "d MMM")} – ${format(new Date(sprint.end_date), "d MMM")}`
      : null;

  const capacityLabel =
    sprint.capacity_points > 0
      ? `${sprint.planned_points ?? 0}/${sprint.capacity_points} pts`
      : null;

  async function handleActivate() {
    await activateSprint.mutateAsync(sprint.id);
  }

  async function handleComplete() {
    if (
      confirm(
        `Complete sprint "${sprint.name}"? This will create a sprint review.`,
      )
    ) {
      setCompleting(true);
      try {
        await completeSprint.mutateAsync({ id: sprint.id });
      } finally {
        setCompleting(false);
      }
    }
  }

  return (
    <div
      ref={dropRef}
      className={cn(
        "rounded-lg border bg-card overflow-hidden transition-shadow",
        isOver && "ring-2 ring-primary ring-offset-1",
      )}
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-card">
        {/* Collapse toggle */}
        <button
          type="button"
          onClick={() => toggleSprintCollapse(sprint.id)}
          className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
          aria-label={isCollapsed ? "Expand sprint" : "Collapse sprint"}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>

        {/* Sprint name */}
        <Link
          href={`/sprints/${sprint.id}`}
          className="text-sm font-semibold hover:text-primary transition-colors truncate max-w-[12rem]"
        >
          {sprint.name}
        </Link>

        {/* Status badge */}
        <Badge
          className={cn(
            "text-xs shrink-0",
            SPRINT_STATUS_CLASS[sprint.status] ?? SPRINT_STATUS_CLASS.planned,
          )}
        >
          {sprint.status.charAt(0).toUpperCase() + sprint.status.slice(1)}
        </Badge>

        {/* Date range */}
        {dateRange && (
          <span className="hidden sm:inline text-xs text-muted-foreground whitespace-nowrap">
            {dateRange}
          </span>
        )}

        {/* Item count */}
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          ({rawItems.length} {rawItems.length === 1 ? "item" : "items"})
        </span>

        {/* Capacity */}
        {capacityLabel && (
          <span className="text-xs text-muted-foreground hidden md:inline whitespace-nowrap">
            {capacityLabel}
          </span>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Stats */}
        {!isCollapsed && <SprintStats items={rawItems} />}

        {/* Primary action */}
        {sprint.status === "planned" && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1.5 shrink-0"
            onClick={handleActivate}
            disabled={activateSprint.isPending}
          >
            {activateSprint.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Rocket className="h-3 w-3" />
            )}
            Start sprint
          </Button>
        )}
        {sprint.status === "active" && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1.5 shrink-0"
            onClick={handleComplete}
            disabled={completing || completeSprint.isPending}
          >
            {completing ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3 w-3" />
            )}
            Complete sprint
          </Button>
        )}
        {sprint.status === "completed" && (
          <Button size="sm" variant="ghost" className="h-7 text-xs" asChild>
            <Link href={`/sprints/${sprint.id}`}>
              <LinkIcon className="h-3 w-3 mr-1" />
              View review
            </Link>
          </Button>
        )}

        {/* Context menu */}
        <DropdownMenuPrimitive.Root>
          <DropdownMenuPrimitive.Trigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              aria-label="Sprint actions"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuPrimitive.Trigger>
          <DropdownMenuPrimitive.Portal>
            <DropdownMenuPrimitive.Content
              align="end"
              sideOffset={4}
              className={cn(
                "z-50 min-w-[11rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md",
                "data-[state=open]:animate-in data-[state=closed]:animate-out",
                "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
                "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
              )}
            >
              <DropdownMenuPrimitive.Item
                asChild
                className={cn(
                  "flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent",
                )}
              >
                <Link href={`/sprints/${sprint.id}`}>View sprint details</Link>
              </DropdownMenuPrimitive.Item>
              <DropdownMenuPrimitive.Item
                onSelect={() => openCreateItem(sprint.id)}
                className={cn(
                  "flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent",
                )}
              >
                Add work item
              </DropdownMenuPrimitive.Item>
            </DropdownMenuPrimitive.Content>
          </DropdownMenuPrimitive.Portal>
        </DropdownMenuPrimitive.Root>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      {!isCollapsed && (
        <>
          {isLoading ? (
            <div className="flex h-10 items-center justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 && rawItems.length > 0 ? (
            <div className="px-4 py-4 text-sm text-muted-foreground text-center">
              No items match the current filters.
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-4 py-6 text-sm text-muted-foreground text-center border-b border-dashed mx-4 my-2 rounded-md bg-muted/30">
              Plan a sprint by dragging work items into it, or create one below.
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {/* Column header */}
              <div className="hidden sm:flex items-center gap-2 px-4 py-1.5 bg-muted/30 text-xs text-muted-foreground">
                <span className="w-5 shrink-0" />
                <span className="flex-1">Work</span>
                <span className="hidden sm:inline w-10 text-center">Sub</span>
                <span className="hidden sm:inline w-4 text-center">P</span>
                <span className="w-24 text-center">Status</span>
                <span className="hidden sm:inline w-10 text-center">Pts</span>
                <span className="hidden sm:inline w-16 text-right">Due</span>
                <span className="w-7 shrink-0" />
              </div>
              {filtered.map((item) => (
                <WorkItemRow
                  key={item.id}
                  item={item}
                  sprintId={sprint.id}
                  sprints={allSprints}
                  currentSprintId={sprint.id}
                />
              ))}
            </div>
          )}

          {/* Quick add */}
          {sprint.status !== "completed" && (
            <div className="border-t border-dashed border-border/60">
              <QuickAddRow sprint_id={sprint.id} label="Create" />
            </div>
          )}
        </>
      )}
    </div>
  );
}
