"use client";

import { useCallback, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  closestCorners,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { createPortal } from "react-dom";
import { Plus, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import type { WorkItemListItem } from "@/types";
import { BoardColumn } from "./BoardColumn";
import { BoardCard } from "./BoardCard";
import { useBoardStore, type BoardColumn as BoardColumnState } from "../store";
import { useMoveItemToColumn, useReorderColumns, useCreateColumn, boardKeys } from "../hooks/useSprintBoard";
import { matchesBoardFilters } from "./BoardFilters";
import { useProjectStore } from "@/stores";
import { useDeleteWorkItem } from "@/features/workitems/hooks/useWorkItems";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { AddColumnDialog } from "./AddColumnDialog";

// ─── Delete drop-zone ───────────────────────────────────────────────────────
// Appears while a card is being dragged; dropping a card here deletes it.

function DeleteDropZone({ visible }: { visible: boolean }) {
  const { setNodeRef, isOver } = useDroppable({
    id: "delete-zone",
    data: { type: "delete" },
  });

  if (!visible) return null;

  return createPortal(
    <div
      ref={setNodeRef}
      className={cn(
        "fixed left-4 top-24 z-50 flex w-44 flex-col items-center justify-center gap-1.5",
        "rounded-xl border-2 border-dashed px-4 py-6 text-xs font-medium transition-all",
        isOver
          ? "border-destructive bg-destructive/15 text-destructive scale-105 shadow-lg"
          : "border-destructive/40 bg-background/90 text-destructive/70 backdrop-blur",
      )}
      aria-label="Drop here to delete"
    >
      <Trash2 className={cn("h-6 w-6 transition-transform", isOver && "scale-110")} />
      {isOver ? "Release to delete" : "Drag here to delete"}
    </div>,
    document.body,
  );
}

// ─── Active drag state ────────────────────────────────────────────────────────

interface ActiveCardDrag {
  kind: "card";
  item: WorkItemListItem;
  columnId: string;
}

interface ActiveColumnDrag {
  kind: "column";
  column: BoardColumnState;
}

type ActiveDrag = ActiveCardDrag | ActiveColumnDrag;

// ─── Component ────────────────────────────────────────────────────────────────

interface SprintBoardDndProps {
  sprintId: string;
}

export function SprintBoardDnd({ sprintId }: SprintBoardDndProps) {
  const { columns, setColumns, setIsDragging, filters } = useBoardStore();
  const moveToColumn = useMoveItemToColumn();
  const reorderColumns = useReorderColumns();
  const createColumn = useCreateColumn();
  const deleteItem = useDeleteWorkItem();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const currentProjectId = useProjectStore((s) => s.currentProjectId);

  const [active, setActive] = useState<ActiveDrag | null>(null);
  const [addColumnOpen, setAddColumnOpen] = useState(false);

  const columnIds = useMemo(() => columns.map((c) => c.id), [columns]);

  // ── Sensors ────────────────────────────────────────────────────────────────

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // ── Helpers ────────────────────────────────────────────────────────────────

  const findColumnContainingItem = useCallback(
    (itemId: string) =>
      columns.find((col) => (col.items ?? []).some((i) => i.id === itemId)),
    [columns],
  );

  // ── DnD handlers ──────────────────────────────────────────────────────────

  const onDragStart = useCallback(
    ({ active: a }: DragStartEvent) => {
      setIsDragging(true);

      const data = a.data.current as
        | { type: "board-card"; itemId: string; columnId: string }
        | { type: "board-column"; columnId: string }
        | undefined;

      if (!data) return;

      if (data.type === "board-card") {
        const col = columns.find((c) => c.id === data.columnId);
        const item = (col?.items ?? []).find((i) => i.id === data.itemId);
        if (item) setActive({ kind: "card", item, columnId: data.columnId });
      } else if (data.type === "board-column") {
        const col = columns.find((c) => c.id === data.columnId);
        if (col) setActive({ kind: "column", column: col });
      }
    },
    [columns, setIsDragging],
  );

  const onDragOver = useCallback(
    ({ active: a, over }: DragOverEvent) => {
      if (!over || !a.data.current) return;

      const activeData = a.data.current as
        | { type: "board-card"; itemId: string; columnId: string }
        | { type: "board-column"; columnId: string };

      if (activeData.type !== "board-card") return;

      const overData = over.data.current as
        | { type: "board-card"; itemId: string; columnId: string }
        | { type: "column-drop"; columnId: string }
        | undefined;
      if (!overData) return;

      const srcColumnId = activeData.columnId;
      const itemId = activeData.itemId;

      let dstColumnId: string;
      let dstIndex: number;

      if (overData.type === "column-drop") {
        dstColumnId = overData.columnId;
        const dstCol = columns.find((c) => c.id === dstColumnId);
        dstIndex = (dstCol?.items ?? []).length;
      } else if (overData.type === "board-card") {
        dstColumnId = overData.columnId;
        const dstCol = columns.find((c) => c.id === dstColumnId);
        const dstItems = dstCol?.items ?? [];
        const overIdx = dstItems.findIndex((i) => i.id === over.id);
        dstIndex = overIdx >= 0 ? overIdx : dstItems.length;
      } else {
        return;
      }

      if (srcColumnId === dstColumnId) return;

      useBoardStore
        .getState()
        .moveItem(itemId, srcColumnId, dstColumnId, dstIndex);

      setActive((prev) =>
        prev?.kind === "card" ? { ...prev, columnId: dstColumnId } : prev,
      );
    },
    [columns],
  );

  const onDragEnd = useCallback(
    ({ active: a, over }: DragEndEvent) => {
      setIsDragging(false);
      setActive(null);

      if (!over || !a.data.current) return;

      const activeData = a.data.current as
        | { type: "board-card"; itemId: string; columnId: string }
        | { type: "board-column"; columnId: string };

      // ── Column reorder ────────────────────────────────────────────────────
      if (activeData.type === "board-column") {
        const overData = over.data.current as
          | { type: "board-column"; columnId: string }
          | undefined;
        if (!overData || overData.type !== "board-column") return;

        const oldIndex = columns.findIndex((c) => c.id === activeData.columnId);
        const newIndex = columns.findIndex((c) => c.id === overData.columnId);
        if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

        const reordered = arrayMove(columns, oldIndex, newIndex);
        // Optimistic update of positions in the store
        setColumns(reordered.map((col, i) => ({ ...col, position: i })));

        reorderColumns.mutate(
          { ids: reordered.map((c) => c.id) },
          {
            onError: () => {
              // Rollback to original order
              setColumns(columns);
            },
          },
        );
        return;
      }

      // ── Card move ─────────────────────────────────────────────────────────
      if (activeData.type !== "board-card") return;

      // ── Drop on delete zone → remove the work item ─────────────────────────
      if (over.id === "delete-zone") {
        const itemId = a.id as string;
        void (async () => {
          const ok = await confirm({
            title: "Delete this work item?",
            description: "This permanently deletes the item and its subtasks. This cannot be undone.",
            confirmText: "Delete",
            destructive: true,
          });
          // Restore the board from server regardless — the optimistic drag may
          // have shuffled the item while passing over columns en route.
          if (ok) {
            deleteItem.mutate(itemId, {
              onSettled: () => qc.invalidateQueries({ queryKey: boardKeys.all }),
            });
          } else {
            qc.invalidateQueries({ queryKey: boardKeys.all });
          }
        })();
        return;
      }

      const currentCol = findColumnContainingItem(a.id as string);
      if (!currentCol) return;

      const overData = over.data.current as
        | { type: "board-card"; itemId: string; columnId: string }
        | { type: "column-drop"; columnId: string }
        | undefined;

      let dstColumnId: string;
      let dstIndex: number;

      if (overData?.type === "board-card") {
        dstColumnId = overData.columnId;
        const dstCol = columns.find((c) => c.id === dstColumnId);
        const dstItems = dstCol?.items ?? [];
        dstIndex = dstItems.findIndex((i) => i.id === over.id);
        if (dstIndex === -1) dstIndex = dstItems.length;
      } else if (overData?.type === "column-drop") {
        dstColumnId = overData.columnId;
        const dstCol = columns.find((c) => c.id === dstColumnId);
        dstIndex = (dstCol?.items ?? []).length;
      } else {
        return;
      }

      const srcColumnId = activeData.columnId;

      moveToColumn.mutate({
        itemId: a.id as string,
        columnId: dstColumnId,
        srcColumnId,
        dstColumnId,
        dstIndex,
      });
    },
    [columns, findColumnContainingItem, moveToColumn, reorderColumns, setColumns, setIsDragging],
  );

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
      >
        {/* Trash drop-zone — only while dragging a card */}
        <DeleteDropZone visible={active?.kind === "card"} />

        <div className="flex gap-4 h-full items-stretch pb-4 w-max min-w-full">
          {/* Column-level horizontal SortableContext for column drag-reorder */}
          <SortableContext
            items={columnIds}
            strategy={horizontalListSortingStrategy}
          >
            {columns.map((col) => (
              <BoardColumn
                key={col.id}
                column={col}
                items={(col.items ?? []).filter((i) =>
                  matchesBoardFilters(i, filters),
                )}
                sprintId={sprintId}
              />
            ))}
          </SortableContext>

          {/* Add column button */}
          <button
            type="button"
            onClick={() => setAddColumnOpen(true)}
            className="flex-shrink-0 flex items-center gap-2 w-[260px] sm:w-72 rounded-xl border border-dashed border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground hover:border-primary/50 hover:text-foreground hover:bg-muted/40 transition-colors self-start"
          >
            <Plus className="h-4 w-4" />
            Add column
          </button>
        </div>

        {typeof window !== "undefined" &&
          createPortal(
            <DragOverlay dropAnimation={{ duration: 180, easing: "ease" }}>
              {active?.kind === "card" && (
                <BoardCard
                  item={active.item}
                  columnId={active.columnId}
                  isOverlay
                />
              )}
              {active?.kind === "column" && (
                <div className="rotate-1 opacity-90 shadow-xl w-72 rounded-xl border bg-muted/40 px-3 py-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-foreground">
                    {active.column.name}
                  </span>
                </div>
              )}
            </DragOverlay>,
            document.body,
          )}
      </DndContext>

      <AddColumnDialog
        open={addColumnOpen}
        onOpenChange={setAddColumnOpen}
        projectId={currentProjectId}
        onCreate={({ name, color }) =>
          createColumn.mutate(
            { name, color: color ?? null, project_id: currentProjectId },
            { onSuccess: () => setAddColumnOpen(false) },
          )
        }
        isPending={createColumn.isPending}
      />
    </>
  );
}
