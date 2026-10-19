"use client";

import { EstimateBadge } from "@/features/estimate";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  CalendarClock,
  Flag,
  GripVertical,
  CheckSquare,
  Circle,
  CheckCircle2,
  Zap,
  Layers,
  Tag,
  GitBranch,
  Github,
  GitPullRequest,
  Trash2,
  Loader2,
} from "lucide-react";
import { format, isPast, isToday, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { WorkItemListItem, Priority } from "@/types";
import { WorkItemTypeBadge } from "@/features/agile/components/WorkItemTypeBadge";
import { useSprintsList } from "@/features/sprints/hooks/useSprints";
import { useEpics } from "@/features/agile/hooks/useEpics";
import { useDeleteWorkItem } from "@/features/hierarchy";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { ItemKeyChip } from "@/components/ui/item-key-chip";
import { useBoardStore } from "../store";
import { boardKeys, useMoveItemToColumn } from "../hooks/useSprintBoard";

// ─── Priority colour helpers ──────────────────────────────────────────────────

const PRIORITY_ICON_COLORS: Record<Priority, string> = {
  critical: "text-red-500",
  high: "text-orange-500",
  medium: "text-yellow-500",
  low: "text-blue-400",
};

const PRIORITY_BADGE_VARIANT: Record<
  Priority,
  "critical" | "high" | "medium" | "low"
> = {
  critical: "critical",
  high: "high",
  medium: "medium",
  low: "low",
};

// ─── Component ────────────────────────────────────────────────────────────────

interface BoardCardProps {
  item: WorkItemListItem;
  /** The id of the column this card currently lives in (used for DnD data). */
  columnId: string;
  /** When true the card renders as a static drag-overlay clone */
  isOverlay?: boolean;
}

export function BoardCard({
  item,
  columnId,
  isOverlay = false,
}: BoardCardProps) {
  const openItemDetail = useBoardStore((s) => s.openItemDetail);
  const removeItem = useBoardStore((s) => s.removeItem);
  const columns = useBoardStore((s) => s.columns);
  const moveItemToColumn = useMoveItemToColumn();
  const deleteWorkItem = useDeleteWorkItem();
  const confirm = useConfirm();
  const qc = useQueryClient();

  const isDone = item.status === "done";

  // Toggle the card's done state by moving it to (or out of) the column whose
  // mapped_status === "done". The backend mirrors the column's mapped_status
  // onto the item's status, so this both relocates the card and flips status.
  function handleToggleDone(e: React.MouseEvent) {
    e.stopPropagation();
    if (isOverlay || moveItemToColumn.isPending) return;

    const doneCol = columns.find((c) => c.mapped_status === "done");
    if (!doneCol) return;

    const dst = isDone
      ? columns.find((c) => c.mapped_status === "todo") ??
        columns.find((c) => c.mapped_status === "backlog") ??
        columns[0]
      : doneCol;
    if (!dst || dst.id === columnId) {
      if (!isDone) return; // already in the done column, nothing to do
    }

    const target = dst ?? doneCol;
    moveItemToColumn.mutate({
      itemId: item.id,
      columnId: target.id,
      srcColumnId: columnId,
      dstColumnId: target.id,
      dstIndex: target.items.length,
    });
  }

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (
      !(await confirm({
        title: `Delete "${item.title}"?`,
        description:
          "It will be moved to the Trash. You can restore it later.",
        confirmText: "Delete",
        destructive: true,
      }))
    )
      return;
    // Optimistically remove from the board, then soft-delete on the server.
    removeItem(item.id);
    try {
      await deleteWorkItem.mutateAsync(item.id);
    } finally {
      // useDeleteWorkItem only invalidates the hierarchy query keys, so the
      // board's own queries (boardKeys + ["work-items"]) must be refetched
      // here to re-hydrate the board store. On failure this restores the card.
      qc.invalidateQueries({ queryKey: boardKeys.all });
      qc.invalidateQueries({ queryKey: ["work-items"] });
    }
  }

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
    data: { type: "board-card", itemId: item.id, columnId },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // ── Due date display ─────────────────────────────────────────────────────────
  const dueDateLabel = item.due_date
    ? isToday(parseISO(item.due_date))
      ? "Today"
      : format(parseISO(item.due_date), "MMM d")
    : null;

  const isOverdue =
    item.due_date &&
    isPast(parseISO(item.due_date)) &&
    item.status !== "done";

  // ── Subtasks ─────────────────────────────────────────────────────────────────
  const subtaskCount = item.subtask_count ?? 0;
  const doneSubtaskCount = item.done_subtask_count ?? 0;
  const allSubtasksDone = subtaskCount > 0 && doneSubtaskCount === subtaskCount;

  // ── Detail-field lookups (sprint / epic names) ─────────────────────────────────
  const sprints = useSprintsList().data?.data ?? [];
  const epics = useEpics().data?.data ?? [];
  const sprintName = item.sprint_id
    ? sprints.find((s) => s.id === item.sprint_id)?.name ?? null
    : null;
  const epicTitle = item.epic_id
    ? epics.find((e) => e.id === item.epic_id)?.title ?? null
    : null;

  const labels = item.labels ?? [];
  const startDateLabel = item.start_date
    ? format(parseISO(item.start_date), "MMM d")
    : null;

  // Only Details fields the user pinned (Pin icon in the detail sheet) render
  // on the card.  Default = nothing pinned → clean card.
  const pinned = item.pinned_fields ?? [];
  const isPinned = (key: string) => pinned.includes(key);

  const showSprint = isPinned("sprint") && !!sprintName;
  const showParent = isPinned("parent") && !!epicTitle;
  const showLabels = isPinned("labels") && labels.length > 0;
  const showStart = isPinned("start_date") && !!startDateLabel;
  const showRepo = isPinned("github_repo") && !!item.github_repo;
  const showBranch = isPinned("github_branch") && !!item.github_branch;
  const showPr = isPinned("github_pr") && !!item.github_pr;

  // Whether any detail-field tag will render (controls the meta block).
  const hasMeta =
    showSprint || showParent || showLabels || showStart || showRepo || showBranch || showPr;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm",
        "transition-shadow duration-150",
        isDragging && "opacity-40 shadow-none ring-2 ring-primary/20",
        isOverlay && "rotate-1 shadow-xl ring-2 ring-primary/30",
        !isDragging && !isOverlay && "hover:shadow-md cursor-pointer",
      )}
      onClick={() => !isDragging && openItemDetail(item.id)}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className={cn(
          "absolute left-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded",
          "text-muted-foreground/30 hover:text-muted-foreground/70",
          "opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing",
          "focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        )}
        onClick={(e) => e.stopPropagation()}
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>

      {/* Delete (soft-delete to Trash) */}
      {!isOverlay && (
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleteWorkItem.isPending}
          className={cn(
            "absolute right-1.5 top-1.5 z-10 p-1 rounded",
            "text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10",
            "opacity-0 group-hover:opacity-100 transition-opacity",
            "focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          )}
          aria-label="Delete work item"
          title="Delete (move to Trash)"
        >
          {deleteWorkItem.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
        </button>
      )}

      <div className="px-3 py-2.5 pl-7 pr-7 space-y-1.5">
        {/* Type tag row */}
        <div className="flex items-center gap-1.5">
          {/* Done toggle */}
          {!isOverlay && (
            <button
              type="button"
              onClick={handleToggleDone}
              disabled={moveItemToColumn.isPending}
              className={cn(
                "shrink-0 rounded-full transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                isDone
                  ? "text-emerald-500 hover:text-emerald-600"
                  : "text-muted-foreground/50 hover:text-foreground",
              )}
              aria-label={isDone ? "Mark not done" : "Mark done"}
              title={isDone ? "Mark not done" : "Mark done"}
            >
              {isDone ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <Circle className="h-4 w-4" />
              )}
            </button>
          )}
          <WorkItemTypeBadge type={item.type} showLabel className="shrink-0" />
          {item.story_points != null && (
            <Badge
              variant="outline"
              className="h-4 px-1.5 text-[10px] font-medium shrink-0"
            >
              <EstimateBadge projectId={item.project_id} value={item.story_points} />
            </Badge>
          )}
        </div>

        {/* Title */}
        <p
          className={cn(
            "text-sm font-medium leading-snug line-clamp-2 break-words [overflow-wrap:anywhere]",
            item.status === "done" && "line-through text-muted-foreground",
          )}
        >
          <ItemKeyChip itemKey={item.key} className="mr-1.5 align-middle" />
          {item.title}
        </p>

        {/* Detail-field tags */}
        {hasMeta && (
          <div className="flex flex-wrap items-center gap-1 pt-0.5">
            {showSprint && (
              <span className="inline-flex items-center gap-0.5 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                <Zap className="h-2.5 w-2.5 shrink-0" />
                <span className="max-w-[8rem] truncate">{sprintName}</span>
              </span>
            )}
            {showParent && (
              <span className="inline-flex items-center gap-0.5 rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
                <Layers className="h-2.5 w-2.5 shrink-0" />
                <span className="max-w-[8rem] truncate">{epicTitle}</span>
              </span>
            )}
            {showLabels &&
              labels.map((label) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
                >
                  <Tag className="h-2.5 w-2.5 shrink-0" />
                  <span className="max-w-[7rem] truncate">{label}</span>
                </span>
              ))}
            {showStart && (
              <span className="inline-flex items-center gap-0.5 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                <CalendarClock className="h-2.5 w-2.5 shrink-0" />
                {startDateLabel}
              </span>
            )}
            {showRepo && (
              <span className="inline-flex items-center gap-0.5 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                <Github className="h-2.5 w-2.5 shrink-0" />
                <span className="max-w-[8rem] truncate">{item.github_repo}</span>
              </span>
            )}
            {showBranch && (
              <span className="inline-flex items-center gap-0.5 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                <GitBranch className="h-2.5 w-2.5 shrink-0" />
                <span className="max-w-[8rem] truncate">{item.github_branch}</span>
              </span>
            )}
            {showPr && (
              <span className="inline-flex items-center gap-0.5 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                <GitPullRequest className="h-2.5 w-2.5 shrink-0" />
                <span className="max-w-[6rem] truncate">{item.github_pr}</span>
              </span>
            )}
          </div>
        )}

        {/* Footer row */}
        <div className="flex items-center justify-between gap-1 pt-0.5">
          <div className="flex items-center gap-2">
            {/* Priority flag */}
            <Flag
              className={cn(
                "h-3 w-3 shrink-0",
                PRIORITY_ICON_COLORS[item.priority],
              )}
              aria-label={`Priority: ${item.priority}`}
            />

            {/* Due date */}
            {dueDateLabel && (
              <span
                className={cn(
                  "flex items-center gap-0.5 text-[11px] tabular-nums",
                  isOverdue
                    ? "text-destructive font-medium"
                    : "text-muted-foreground",
                )}
              >
                <CalendarDays className="h-3 w-3" />
                {dueDateLabel}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {/* Subtasks */}
            {subtaskCount > 0 && (
              <span
                className={cn(
                  "flex items-center gap-0.5 text-[11px]",
                  allSubtasksDone
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-muted-foreground",
                )}
              >
                <CheckSquare className="h-3 w-3" />
                {doneSubtaskCount}/{subtaskCount}
              </span>
            )}

            {/* Critical badge */}
            {item.priority === "critical" && (
              <Badge
                variant={PRIORITY_BADGE_VARIANT[item.priority]}
                className="h-4 px-1 text-[10px]"
              >
                !
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
