"use client";

import { useCallback, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { createPortal } from "react-dom";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import type { Task, TaskStatus } from "@/types";
import type { KanbanColumn } from "../types";
import { KanbanColumn as KanbanColumnComp } from "./KanbanColumn";
import { KanbanCard } from "./KanbanCard";
import { AddCardDialog } from "./AddCardDialog";
import { CardDetailDialog } from "./CardDetailDialog";
import { useKanbanColumns } from "../hooks/useKanbanColumns";
import { useMoveCard } from "../hooks/useKanbanMutations";
import { useKanbanStore } from "../store";

// ─── Active drag state ────────────────────────────────────────────────────────

type ActiveDrag =
  | { type: "card"; task: Task; columnId: TaskStatus }
  | { type: "column"; column: KanbanColumn };

// ─── Board ────────────────────────────────────────────────────────────────────

export function KanbanBoard() {
  const { isLoading, isError, refetch } = useKanbanColumns();
  const { columns, addingCardToColumnId, setIsDragging } = useKanbanStore();

  const moveCard = useMoveCard();

  const [active, setActive] = useState<ActiveDrag | null>(null);

  const columnIds = useMemo(() => columns.map((c) => c.id), [columns]);

  // ─── DnD sensors ────────────────────────────────────────────────────────────

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  const findColumnContainingTask = useCallback(
    (taskId: string): KanbanColumn | undefined => {
      return columns.find((col) =>
        (col.tasks ?? []).some((t) => t.id === taskId),
      );
    },
    [columns],
  );

  // ─── DnD handlers ────────────────────────────────────────────────────────────

  const onDragStart = useCallback(
    ({ active: a }: DragStartEvent) => {
      setIsDragging(true);

      const data = a.data.current as
        | { type: "card"; taskId: string; columnId: TaskStatus }
        | undefined;

      if (!data) return;

      if (data.type === "card") {
        const col = columns.find((c) => c.id === data.columnId);
        const task = (col?.tasks ?? []).find((t) => t.id === data.taskId);
        if (task) setActive({ type: "card", task, columnId: data.columnId });
      }
    },
    [columns, setIsDragging],
  );

  const onDragOver = useCallback(
    ({ active: a, over }: DragOverEvent) => {
      if (!over || !a.data.current) return;

      const activeData = a.data.current as
        | { type: "card"; taskId: string; columnId: TaskStatus };

      if (activeData.type !== "card") return;

      const overData = over.data.current as
        | { type: "card"; taskId: string; columnId: TaskStatus }
        | { type: "column-drop"; columnId: TaskStatus }
        | undefined;

      if (!overData) return;

      const srcColId = activeData.columnId;
      const taskId = activeData.taskId;

      let dstColId: TaskStatus;
      let dstIndex: number;

      if (overData.type === "column-drop") {
        dstColId = overData.columnId;
        const dstCol = columns.find((c) => c.id === dstColId);
        dstIndex = (dstCol?.tasks ?? []).length;
      } else if (overData.type === "card") {
        dstColId = overData.columnId;
        const dstCol = columns.find((c) => c.id === dstColId);
        const dstTasks = dstCol?.tasks ?? [];
        const overIdx = dstTasks.findIndex((t) => t.id === over.id);
        dstIndex = overIdx >= 0 ? overIdx : dstTasks.length;
      } else {
        return;
      }

      if (srcColId === dstColId) return; // Same-column reorder handled in onDragEnd

      // Optimistic visual update
      const store = useKanbanStore.getState();
      store.moveCard(taskId, srcColId, dstColId, dstIndex);

      // Update the active drag's column reference so subsequent overs work
      if (active?.type === "card") {
        setActive((prev) =>
          prev?.type === "card" ? { ...prev, columnId: dstColId } : prev,
        );
      }
    },
    [columns, active],
  );

  const onDragEnd = useCallback(
    ({ active: a, over }: DragEndEvent) => {
      setIsDragging(false);
      setActive(null);

      if (!over) return;

      const activeData = a.data.current as
        | { type: "card"; taskId: string; columnId: TaskStatus }
        | undefined;

      if (!activeData || activeData.type !== "card") return;

      // Determine where the card landed
      const currentCol = findColumnContainingTask(a.id as string);
      if (!currentCol) return;

      const overData = over.data.current as
        | { type: "card"; taskId: string; columnId: TaskStatus }
        | { type: "column-drop"; columnId: TaskStatus }
        | undefined;

      let dstColId: TaskStatus;
      let dstIndex: number;

      if (overData?.type === "card") {
        dstColId = overData.columnId;
        const dstCol = columns.find((c) => c.id === dstColId);
        const dstTasks = dstCol?.tasks ?? [];
        dstIndex = dstTasks.findIndex((t) => t.id === over.id);
        if (dstIndex === -1) dstIndex = dstTasks.length;
      } else if (overData?.type === "column-drop") {
        dstColId = overData.columnId;
        const dstCol = columns.find((c) => c.id === dstColId);
        dstIndex = (dstCol?.tasks ?? []).length;
      } else {
        return;
      }

      const srcColId = activeData.columnId;

      moveCard.mutate({
        taskId: a.id as string,
        newStatus: dstColId,
        srcColumnId: srcColId,
        dstColumnId: dstColId,
        dstIndex,
      });
    },
    [columns, findColumnContainingTask, moveCard, setIsDragging],
  );

  // ─── Render ───────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center gap-3 text-muted-foreground">
        <RefreshCw className="h-4 w-4 animate-spin" />
        Loading board…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-muted-foreground">
        <p>Failed to load the board.</p>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
      >
        <ScrollArea className="h-full w-full">
          <div className="flex gap-4 p-1 pb-4 h-full items-start">
            <SortableContext
              items={columnIds}
              strategy={horizontalListSortingStrategy}
            >
              {columns.map((col) => (
                <KanbanColumnComp key={col.id} column={col} />
              ))}
            </SortableContext>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        {/* Drag overlays */}
        {typeof window !== "undefined" &&
          createPortal(
            <DragOverlay dropAnimation={{ duration: 200, easing: "ease" }}>
              {active?.type === "card" && (
                <KanbanCard
                  task={active.task}
                  columnId={active.columnId}
                  isOverlay
                />
              )}
            </DragOverlay>,
            document.body,
          )}
      </DndContext>

      {/* Dialogs rendered outside DnD context to avoid pointer-event issues */}
      <CardDetailDialog />
      {columns.map((col) => (
        <AddCardDialog key={col.id} columnId={col.id} />
      ))}
      {/* Also render for the currently-adding column in case it wasn't in columns yet */}
      {addingCardToColumnId &&
        !columns.some((c) => c.id === addingCardToColumnId) && (
          <AddCardDialog columnId={addingCardToColumnId} />
        )}
    </>
  );
}
