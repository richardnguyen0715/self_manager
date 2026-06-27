"use client";

import { Plus, ClipboardList, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { TaskListItem } from "@/types";
import { useTasks } from "../hooks/useTasks";
import { useTaskUIStore } from "../store";
import { TaskRow } from "./TaskRow";
import { TaskFilters } from "./TaskFilters";
import { TaskDialog } from "./TaskDialog";

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  const { openCreateDialog, resetFilters } = useTaskUIStore();

  if (hasFilters) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <ClipboardList className="h-10 w-10 text-muted-foreground/50 mb-3" />
        <p className="text-sm font-medium">No tasks match your filters</p>
        <p className="text-xs text-muted-foreground mt-1">
          Try adjusting the filters or search query.
        </p>
        <Button variant="outline" size="sm" onClick={resetFilters} className="mt-4">
          Clear filters
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <ClipboardList className="h-10 w-10 text-muted-foreground/50 mb-3" />
      <p className="text-sm font-medium">No tasks yet</p>
      <p className="text-xs text-muted-foreground mt-1">
        Create your first task to get started.
      </p>
      <Button size="sm" onClick={() => openCreateDialog()} className="mt-4 gap-1.5">
        <Plus className="h-4 w-4" />
        Create task
      </Button>
    </div>
  );
}

// ─── Error state ──────────────────────────────────────────────────────────────

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <AlertCircle className="h-10 w-10 text-destructive/60 mb-3" />
      <p className="text-sm font-medium text-destructive">Failed to load tasks</p>
      <p className="text-xs text-muted-foreground mt-1">{message}</p>
    </div>
  );
}

// ─── Skeleton row ─────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 animate-pulse">
      <span className="h-4 w-4 rounded-full bg-muted shrink-0" />
      <span className="h-5 w-5 rounded-full bg-muted shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3.5 bg-muted rounded w-2/3" />
        <div className="h-3 bg-muted rounded w-1/3" />
      </div>
    </div>
  );
}

// ─── Pagination bar ───────────────────────────────────────────────────────────

interface PaginationBarProps {
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

function PaginationBar({
  total,
  page,
  perPage,
  totalPages,
  onPageChange,
}: PaginationBarProps) {
  const from = (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);

  return (
    <div className="flex items-center justify-between px-3 py-2 border-t text-xs text-muted-foreground">
      <span>
        {from}–{to} of {total}
      </span>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
        >
          Prev
        </Button>
        <span className="px-1 tabular-nums">
          {page} / {totalPages}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

// ─── Main list ────────────────────────────────────────────────────────────────

export function TaskList() {
  const { filters, openCreateDialog } = useTaskUIStore();

  // We manage page locally; filters changes reset to page 1 implicitly since
  // it's part of the query key.
  const { data, isLoading, isError, error, isFetching } = useTasks({
    ...filters,
    // pass page when we add it — for now backend defaults to page 1
  });

  const tasks: TaskListItem[] = data ?? [];
  const total = tasks.length;
  // Backend returns a flat array with no pagination envelope; pagination is
  // driven by limit/offset query params. UI pagination is a future enhancement.
  const totalPages = 1;
  const currentPage = 1;
  const perPage = tasks.length;

  const hasActiveFilters =
    filters.status !== "all" ||
    filters.priority !== "all" ||
    filters.project_id !== "all" ||
    filters.tag_id !== "all" ||
    filters.due_filter !== "all" ||
    filters.search !== "";

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold">Tasks</h1>
          {total > 0 && (
            <span className="text-sm text-muted-foreground tabular-nums">
              ({total})
            </span>
          )}
          {isFetching && !isLoading && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>

        <Button onClick={() => openCreateDialog()} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          New task
        </Button>
      </div>

      {/* Filters */}
      <div className="mb-4">
        <TaskFilters />
      </div>

      <Separator className="mb-3" />

      {/* List */}
      <div
        className={cn(
          "flex-1 overflow-hidden rounded-md border bg-card",
          "flex flex-col",
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
        ) : tasks.length === 0 ? (
          <EmptyState hasFilters={hasActiveFilters} />
        ) : (
          <>
            <ScrollArea className="flex-1">
              <div className="divide-y divide-border/30 py-1">
                {tasks.map((task) => (
                  <TaskRow key={task.id} task={task} />
                ))}
              </div>
            </ScrollArea>

            {totalPages > 1 && (
              <PaginationBar
                total={total}
                page={currentPage}
                perPage={perPage}
                totalPages={totalPages}
                onPageChange={() => {
                  // Page management: extend filters with page when backend supports it
                  // Placeholder — full pagination requires adding `page` to filters state
                }}
              />
            )}
          </>
        )}
      </div>

      {/* Global task create/edit dialog */}
      <TaskDialog />
    </div>
  );
}
