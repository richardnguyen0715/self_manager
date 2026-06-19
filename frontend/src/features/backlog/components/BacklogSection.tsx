"use client";

/**
 * BacklogSection — the unscheduled work items band at the bottom of the backlog view.
 * GET /api/backlog → { data: WorkItemListItem[], total }
 * Supports: filter by type/priority/epic, quick add, assign to sprint from row menu.
 */

import { ChevronDown, ChevronRight, Loader2, Plus, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { WorkItemListItem, Sprint, Epic } from "@/types";
import { useDroppable } from "@dnd-kit/core";
import { useBacklog } from "@/features/agile";
import { useBacklogStore } from "../store/useBacklogStore";
import { useProjectStore } from "@/stores";
import { WorkItemRow } from "./WorkItemRow";
import { QuickAddRow } from "./QuickAddRow";
import type { BacklogFiltersState } from "../store/useBacklogStore";

// ─── Filter helper ────────────────────────────────────────────────────────────

function applyFilters(
  items: WorkItemListItem[],
  filters: BacklogFiltersState,
): WorkItemListItem[] {
  return items.filter((item) => {
    if (filters.type !== "all" && item.type !== filters.type) return false;
    if (filters.priority !== "all" && item.priority !== filters.priority) return false;
    if (filters.epic_id !== "all" && item.epic_id !== filters.epic_id) return false;
    if (
      filters.search &&
      !item.title.toLowerCase().includes(filters.search.toLowerCase())
    )
      return false;
    return true;
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

interface BacklogSectionProps {
  sprints: Sprint[];
  epics: Epic[];
}

export function BacklogSection({ sprints, epics: _epics }: BacklogSectionProps) {
  const {
    filters,
    backlogCollapsed,
    toggleBacklogCollapse,
    openCreateItem,
    openCreateSprint,
  } = useBacklogStore();
  const { currentProjectId } = useProjectStore();

  // Uses the dedicated /api/backlog endpoint (sprint_id IS NULL view)
  const epicFilter =
    filters.epic_id !== "all" ? filters.epic_id : undefined;
  const backlogParams: { epic_id?: string; project_id?: string | null } = {};
  if (epicFilter) backlogParams.epic_id = epicFilter;
  if (currentProjectId != null) backlogParams.project_id = currentProjectId;
  const { data, isLoading, isError, refetch } = useBacklog(
    Object.keys(backlogParams).length > 0 ? backlogParams : undefined,
  );

  const rawItems: WorkItemListItem[] = data?.data ?? [];
  const total: number = data?.total ?? rawItems.length;

  // Client-side type/priority/search filter on top of the server epic filter
  const filtered = applyFilters(rawItems, { ...filters, epic_id: "all" });

  // Estimate total story points visible
  const estimatePoints = filtered.reduce(
    (sum, i) => sum + (i.story_points ?? 0),
    0,
  );

  const activeSprints = sprints.filter((s) => s.status !== "completed");

  const { setNodeRef: dropRef, isOver } = useDroppable({
    id: "backlog-drop",
    data: { type: "backlog-drop" },
  });

  return (
    <div
      ref={dropRef}
      className={cn(
        "rounded-lg border bg-card overflow-hidden transition-shadow",
        isOver && "ring-2 ring-primary ring-offset-1",
      )}
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 px-4 py-2.5 border-b bg-card">
        {/* Collapse toggle */}
        <button
          type="button"
          onClick={toggleBacklogCollapse}
          className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
          aria-label={backlogCollapsed ? "Expand backlog" : "Collapse backlog"}
        >
          {backlogCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>

        <h2 className="text-sm font-semibold">Backlog</h2>

        <Badge variant="secondary" className="text-xs">
          {total}
        </Badge>

        <div className="flex-1 min-w-0" />

        {/* Estimate summary — hidden on mobile */}
        {estimatePoints > 0 && (
          <span className="hidden sm:inline text-xs text-muted-foreground whitespace-nowrap">
            Estimate: {estimatePoints} of{" "}
            {rawItems.reduce((sum, i) => sum + (i.story_points ?? 0), 0)} pts
          </span>
        )}

        {/* Create sprint */}
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1.5 shrink-0"
          onClick={openCreateSprint}
        >
          <Plus className="h-3 w-3" />
          <span className="hidden sm:inline">Create sprint</span>
          <span className="sm:hidden">Sprint</span>
        </Button>

        {/* Quick add item */}
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs shrink-0"
          onClick={() => openCreateItem()}
          aria-label="Create work item"
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Create
        </Button>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      {!backlogCollapsed && (
        <>
          {isLoading ? (
            <div className="flex h-16 items-center justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
              <AlertCircle className="h-5 w-5" />
              <p className="text-sm">Failed to load backlog.</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetch()}
                className="gap-1.5"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry
              </Button>
            </div>
          ) : filtered.length === 0 && rawItems.length > 0 ? (
            <div className="px-4 py-4 text-sm text-muted-foreground text-center">
              No items match the current filters.
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-4 py-8 text-sm text-muted-foreground text-center">
              No items in the backlog.{" "}
              <button
                type="button"
                onClick={() => openCreateItem()}
                className="text-primary hover:underline"
              >
                Create one
              </button>
              {activeSprints.length === 0 && (
                <>
                  {" "}or{" "}
                  <button
                    type="button"
                    onClick={openCreateSprint}
                    className="text-primary hover:underline"
                  >
                    create a sprint
                  </button>
                </>
              )}
              .
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
                <span className="hidden md:inline w-10 text-center">Pts</span>
                <span className="hidden md:inline w-16 text-right">Due</span>
                <span className="w-7 shrink-0" />
              </div>
              {filtered.map((item) => (
                <WorkItemRow
                  key={item.id}
                  item={item}
                  sprints={activeSprints}
                  currentSprintId={null}
                />
              ))}
            </div>
          )}

          {/* Quick add at bottom */}
          <div className={cn("border-t border-dashed border-border/60", filtered.length === 0 && "border-t-0")}>
            <QuickAddRow label="Create" />
          </div>
        </>
      )}
    </div>
  );
}
