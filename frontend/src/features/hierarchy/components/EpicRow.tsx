"use client";

import { EstimateBadge } from "@/features/estimate";
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
import { cn } from "@/lib/utils";
import type { Epic, WorkItemListItem } from "@/types";
import { useEpicWorkItems } from "../hooks/useHierarchy";
import { useHierarchyStore } from "../store/hierarchy.store";
import { GoalProgressBar } from "@/features/goals/components/GoalProgressBar";
import { WorkItemStatusBadge } from "./WorkItemStatusBadge";
import { WorkItemTypeBadge } from "./WorkItemTypeBadge";
import { PriorityBadge } from "./PriorityBadge";

// ─── Epic status badge ─────────────────────────────────────────────────────────

function EpicStatusChip({ status }: { status: string }) {
  const CONFIG: Record<string, string> = {
    todo: "bg-secondary text-secondary-foreground",
    in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    done: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    cancelled: "bg-muted text-muted-foreground",
  };
  const label = status === "in_progress" ? "In Progress" : status.charAt(0).toUpperCase() + status.slice(1);
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

// ─── Work item row ─────────────────────────────────────────────────────────────

function WorkItemRow({ item }: { item: WorkItemListItem }) {
  const { openWorkItemDetail } = useHierarchyStore();

  return (
    <tr
      className="border-b last:border-b-0 hover:bg-muted/30 cursor-pointer group/wirow"
      onClick={() => openWorkItemDetail(item.id)}
    >
      <td className="py-2 pl-4 pr-2 w-8">
        <WorkItemTypeBadge type={item.type} />
      </td>
      <td className="py-2 px-2 flex-1">
        <span className="text-sm font-medium">{item.title}</span>
      </td>
      <td className="py-2 px-2 hidden sm:table-cell">
        <PriorityBadge priority={item.priority} showLabel={false} />
      </td>
      <td className="py-2 px-2">
        <WorkItemStatusBadge status={item.status} />
      </td>
      <td className="py-2 px-2 text-xs text-muted-foreground tabular-nums hidden md:table-cell">
        <EstimateBadge projectId={item.project_id} value={item.story_points} />
      </td>
      <td className="py-2 pr-4 text-xs text-muted-foreground tabular-nums hidden sm:table-cell">
        {item.due_date
          ? new Date(item.due_date).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })
          : "—"}
      </td>
    </tr>
  );
}

// ─── Epic row ──────────────────────────────────────────────────────────────────

interface EpicRowProps {
  epic: Epic;
}

export function EpicRow({ epic }: EpicRowProps) {
  const {
    expandedEpics,
    toggleEpicExpanded,
    openEditEpic,
    openDeleteEpic,
    openCreateWorkItem,
  } = useHierarchyStore();

  const isExpanded = Boolean(expandedEpics[epic.id]);

  const { data: workItemsData, isLoading, isError } = useEpicWorkItems(
    epic.id,
    isExpanded,
  );

  const workItems: WorkItemListItem[] = workItemsData?.data ?? [];
  const progressPct = Math.round((epic.progress?.completion_rate ?? 0) * 100);
  const doneItems = epic.progress?.done_items ?? 0;
  const totalItems = epic.progress?.total_items ?? 0;

  return (
    <li>
      {/* Epic header row */}
      <div
        className="flex items-center gap-2 py-2 px-2 rounded-md hover:bg-accent/50 transition-colors cursor-pointer group/epic"
        onClick={() => toggleEpicExpanded(epic.id)}
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleEpicExpanded(epic.id);
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
          className="h-3 w-3 rounded-sm shrink-0"
          style={{ background: epic.color ?? "hsl(var(--primary))" }}
        />

        {/* Title */}
        <span className="flex-1 text-sm font-semibold truncate min-w-0">
          {epic.title}
        </span>

        {/* Status chip */}
        <EpicStatusChip status={epic.status} />

        {/* Progress */}
        <div className="hidden sm:flex items-center gap-2 shrink-0 w-32 md:w-40">
          <GoalProgressBar value={progressPct} showLabel={false} size="sm" />
          <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
            {doneItems}/{totalItems}
          </span>
        </div>

        {/* Points */}
        <span className="hidden md:inline text-xs text-muted-foreground tabular-nums shrink-0 w-12 text-right">
          {epic.done_points ?? 0}/{epic.total_points ?? 0}pt
        </span>

        {/* Actions */}
        <div
          className="flex items-center gap-0.5 opacity-0 group-hover/epic:opacity-100 transition-opacity shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => openCreateWorkItem(epic.id)}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <div className="relative group/epicmenu">
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
            <div
              className={cn(
                "absolute right-0 top-full mt-1 z-20 w-36 rounded-md border bg-popover text-popover-foreground shadow-md",
                "opacity-0 pointer-events-none group-hover/epicmenu:opacity-100 group-hover/epicmenu:pointer-events-auto",
                "transition-opacity duration-100",
              )}
            >
              <div className="p-1 flex flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => openEditEpic(epic.id)}
                  className="flex items-center gap-2 w-full rounded px-2 py-1.5 text-sm hover:bg-accent transition-colors text-left"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => openDeleteEpic(epic.id)}
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

      {/* Expanded work items */}
      {isExpanded && (
        <div className="ml-6 border-l border-border pl-2 mt-0.5 mb-1">
          {isLoading && (
            <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading work items...
            </div>
          )}
          {isError && (
            <div className="flex items-center gap-2 py-2 text-sm text-destructive">
              <AlertCircle className="h-3.5 w-3.5" />
              Failed to load work items
            </div>
          )}
          {!isLoading && !isError && workItems.length === 0 && (
            <p className="py-2 text-xs text-muted-foreground italic">
              No work items in this epic yet.
            </p>
          )}
          {workItems.length > 0 && (
            <div className="border rounded-md overflow-x-auto">
              <table className="w-full min-w-[360px]">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="py-1.5 pl-4 pr-2 w-8" />
                    <th className="py-1.5 px-2 text-left text-xs font-medium text-muted-foreground">
                      Title
                    </th>
                    <th className="py-1.5 px-2 text-left text-xs font-medium text-muted-foreground hidden sm:table-cell">
                      Pri
                    </th>
                    <th className="py-1.5 px-2 text-left text-xs font-medium text-muted-foreground">
                      Status
                    </th>
                    <th className="py-1.5 px-2 text-left text-xs font-medium text-muted-foreground hidden md:table-cell">
                      Pts
                    </th>
                    <th className="py-1.5 pr-4 text-left text-xs font-medium text-muted-foreground hidden sm:table-cell">
                      Due
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {workItems.map((item) => (
                    <WorkItemRow key={item.id} item={item} />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <Button
            variant="ghost"
            size="sm"
            className="mt-1.5 ml-0.5 gap-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => openCreateWorkItem(epic.id)}
          >
            <Plus className="h-3 w-3" />
            Add work item
          </Button>
        </div>
      )}
    </li>
  );
}
