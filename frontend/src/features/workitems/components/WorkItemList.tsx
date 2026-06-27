"use client";

import { useState } from "react";
import Link from "next/link";
import { format, isPast, isToday } from "date-fns";
import {
  Plus,
  SquareKanban,
  Loader2,
  AlertCircle,
  Search,
  X,
  Calendar,
  Trash2,
  MoreHorizontal,
} from "lucide-react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type {
  WorkItemListItem,
  WorkItemType,
  WorkItemStatus,
  Priority,
} from "@/types";
import { WORK_ITEM_TYPES } from "@/types";
import { WORK_ITEM_TYPE_META } from "../work-item-type-config";
import { useWorkItems, useDeleteWorkItem } from "../hooks/useWorkItems";
import { useWorkItemUIStore } from "../store";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useProjectStore } from "@/stores";
import { WorkItemStatusBadge } from "./WorkItemStatusBadge";
import { WorkItemTypeBadge } from "./WorkItemTypeBadge";
import { WorkItemPriorityBadge } from "./WorkItemPriorityBadge";
import { CreateWorkItemDialog } from "./CreateWorkItemDialog";

// ─── Filter bar selects ────────────────────────────────────────────────────────

const TYPE_OPTIONS: { value: WorkItemType | "all"; label: string }[] = [
  { value: "all", label: "All types" },
  ...WORK_ITEM_TYPES.map((t) => ({ value: t, label: WORK_ITEM_TYPE_META[t].label })),
];

const STATUS_OPTIONS: { value: WorkItemStatus | "all"; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "backlog", label: "Backlog" },
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "review", label: "In Review" },
  { value: "done", label: "Done" },
];

const PRIORITY_OPTIONS: { value: Priority | "all"; label: string }[] = [
  { value: "all", label: "All priorities" },
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

// ─── Inline select ─────────────────────────────────────────────────────────────

function FilterSelect<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="h-8 rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

// ─── Empty / error states ──────────────────────────────────────────────────────

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  const { openCreateDialog, resetFilters } = useWorkItemUIStore();
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <SquareKanban className="h-10 w-10 text-muted-foreground/50 mb-3" />
      <p className="text-sm font-medium">
        {hasFilters ? "No work items match your filters" : "No work items yet"}
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        {hasFilters
          ? "Try adjusting the filters or search query."
          : "Create your first work item to get started."}
      </p>
      {hasFilters ? (
        <Button
          variant="outline"
          size="sm"
          onClick={resetFilters}
          className="mt-4"
        >
          Clear filters
        </Button>
      ) : (
        <Button size="sm" onClick={openCreateDialog} className="mt-4 gap-1.5">
          <Plus className="h-4 w-4" />
          Create work item
        </Button>
      )}
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <AlertCircle className="h-10 w-10 text-destructive/60 mb-3" />
      <p className="text-sm font-medium text-destructive">
        Failed to load work items
      </p>
      <p className="text-xs text-muted-foreground mt-1">{message}</p>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 animate-pulse">
      <span className="h-4 w-4 rounded bg-muted shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3.5 bg-muted rounded w-1/2" />
      </div>
      <div className="h-5 w-16 bg-muted rounded hidden sm:block" />
      <div className="h-5 w-14 bg-muted rounded hidden md:block" />
      <div className="h-5 w-8 bg-muted rounded hidden md:block" />
    </div>
  );
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function WorkItemRow({ item }: { item: WorkItemListItem }) {
  const deleteItem = useDeleteWorkItem();
  const confirm = useConfirm();

  const hasSubtasks = (item.subtask_count ?? 0) > 0;

  const dueMeta = item.due_date
    ? (() => {
        const d = new Date(item.due_date);
        const overdue = isPast(d) && !isToday(d);
        const today = isToday(d);
        return {
          label: today ? "Today" : format(d, "MMM d"),
          overdue,
          today,
        };
      })()
    : null;

  async function handleDelete() {
    if (
      !(await confirm({
        title: `Delete "${item.title}"?`,
        description: "This cannot be undone.",
        confirmText: "Delete",
        destructive: true,
      }))
    )
      return;
    deleteItem.mutate(item.id);
  }

  return (
    <div className="group relative flex items-center gap-3 px-4 py-3 hover:bg-accent/40 transition-colors border-b border-border/50 last:border-0">
      {/* Type icon */}
      <WorkItemTypeBadge type={item.type} className="shrink-0" />

      {/* Title */}
      <div className="flex-1 min-w-0">
        <Link
          href={`/work-items/${item.id}`}
          className="text-sm font-medium hover:text-primary transition-colors truncate block"
        >
          {item.title}
        </Link>
        {hasSubtasks && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {item.done_subtask_count ?? 0}/{item.subtask_count} subtasks
          </span>
        )}
      </div>

      {/* Status */}
      <WorkItemStatusBadge status={item.status} className="hidden sm:inline-flex shrink-0" />

      {/* Priority */}
      <WorkItemPriorityBadge
        priority={item.priority}
        showLabel={false}
        className="hidden md:inline-flex shrink-0"
      />

      {/* Story points */}
      <span className="text-xs tabular-nums text-muted-foreground w-8 text-center shrink-0 hidden md:block">
        {item.story_points != null ? item.story_points : "—"}
      </span>

      {/* Due date */}
      {dueMeta ? (
        <span
          className={cn(
            "hidden sm:inline-flex items-center gap-1 text-xs shrink-0",
            dueMeta.overdue
              ? "text-red-600 dark:text-red-400 font-medium"
              : dueMeta.today
                ? "text-amber-600 dark:text-amber-400 font-medium"
                : "text-muted-foreground",
          )}
        >
          <Calendar className="h-3 w-3" />
          {dueMeta.label}
        </span>
      ) : (
        <span className="text-xs text-muted-foreground w-14 text-right shrink-0 hidden sm:block">
          —
        </span>
      )}

      {/* Actions menu (hover) */}
      <DropdownMenuPrimitive.Root>
        <DropdownMenuPrimitive.Trigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity focus-visible:opacity-100"
            onClick={(e) => e.preventDefault()}
            aria-label="Work item actions"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuPrimitive.Trigger>
        <DropdownMenuPrimitive.Portal>
          <DropdownMenuPrimitive.Content
            align="end"
            sideOffset={4}
            className="z-50 min-w-[10rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2"
          >
            <DropdownMenuPrimitive.Item asChild>
              <Link
                href={`/work-items/${item.id}`}
                className="flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none gap-2 focus:bg-accent focus:text-accent-foreground"
              >
                Open
              </Link>
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
  );
}

// ─── Main list ────────────────────────────────────────────────────────────────

export function WorkItemList() {
  const { filters, openCreateDialog, setFilter, resetFilters } =
    useWorkItemUIStore();
  const { currentProjectId } = useProjectStore();

  const [searchValue, setSearchValue] = useState(filters.search ?? "");

  const { data, isLoading, isError, error, isFetching } = useWorkItems({
    status: filters.status !== "all" ? filters.status : undefined,
    type: filters.type !== "all" ? filters.type : undefined,
    priority: filters.priority !== "all" ? filters.priority : undefined,
    search: filters.search || undefined,
    project_id: currentProjectId ?? undefined,
  });

  const items: WorkItemListItem[] = data?.data ?? [];
  const total = data?.total ?? 0;

  const hasActiveFilters =
    filters.status !== "all" ||
    filters.type !== "all" ||
    filters.priority !== "all" ||
    Boolean(filters.search);

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      setFilter("search", searchValue);
    }
  }

  function clearSearch() {
    setSearchValue("");
    setFilter("search", "");
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-y-2 mb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold">Work Items</h1>
          {total > 0 && (
            <span className="text-sm text-muted-foreground tabular-nums">
              ({total})
            </span>
          )}
          {isFetching && !isLoading && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
        <Button onClick={openCreateDialog} size="sm" className="gap-1.5 shrink-0">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">New work item</span>
          <span className="sm:hidden">New</span>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {/* Search */}
        <div className="relative w-full sm:w-auto">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search titles..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="h-8 pl-8 pr-7 w-full sm:w-48 text-sm"
          />
          {searchValue && (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <FilterSelect<WorkItemType | "all">
          value={filters.type ?? "all"}
          onChange={(v) => setFilter("type", v)}
          options={TYPE_OPTIONS}
        />
        <FilterSelect<WorkItemStatus | "all">
          value={filters.status ?? "all"}
          onChange={(v) => setFilter("status", v)}
          options={STATUS_OPTIONS}
        />
        <FilterSelect<Priority | "all">
          value={filters.priority ?? "all"}
          onChange={(v) => setFilter("priority", v)}
          options={PRIORITY_OPTIONS}
        />

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={resetFilters}
            className="h-8 gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </Button>
        )}
      </div>

      <Separator className="mb-3" />

      {/* Table header */}
      {!isLoading && !isError && items.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-1.5 text-xs font-medium text-muted-foreground border-b border-border bg-muted/30 rounded-t-md">
          <span className="w-4 shrink-0" />
          <span className="flex-1">Title</span>
          <span className="w-20 hidden sm:block">Status</span>
          <span className="w-8 hidden md:block text-center">Pri.</span>
          <span className="w-8 hidden md:block text-center">Pts</span>
          <span className="w-14 text-right hidden sm:block">Due</span>
          <span className="w-7 shrink-0" />
        </div>
      )}

      {/* List */}
      <div
        className={cn(
          "flex-1 overflow-hidden rounded-md border bg-card",
          "flex flex-col",
          items.length > 0 && "rounded-t-none border-t-0",
        )}
      >
        {isError ? (
          <ErrorState
            message={
              error instanceof Error ? error.message : "Unknown error occurred"
            }
          />
        ) : isLoading ? (
          <div className="divide-y divide-border/50">
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState hasFilters={hasActiveFilters} />
        ) : (
          <ScrollArea className="flex-1">
            <div className="py-1">
              {items.map((item) => (
                <WorkItemRow key={item.id} item={item} />
              ))}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Create dialog */}
      <CreateWorkItemDialog />
    </div>
  );
}
