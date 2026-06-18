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
import type { WorkItemListItem, WorkItemStatus } from "@/types";
import { BoardColumn } from "./BoardColumn";
import { BoardCard } from "./BoardCard";
import { useBoardStore } from "../store";
import { useMoveItem } from "../hooks/useSprintBoard";

// ─── Active drag state ────────────────────────────────────────────────────────

interface ActiveDrag {
  item: WorkItemListItem;
  columnStatus: WorkItemStatus;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface SprintBoardDndProps {
  sprintId: string;
}

export function SprintBoardDnd({ sprintId }: SprintBoardDndProps) {
  const { columns, setIsDragging } = useBoardStore();
  const moveItem = useMoveItem();
  const [active, setActive] = useState<ActiveDrag | null>(null);

  const columnStatuses = useMemo(() => columns.map((c) => c.status), [columns]);

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
        | { type: "board-card"; itemId: string; columnStatus: WorkItemStatus }
        | undefined;
      if (!data || data.type !== "board-card") return;

      const col = columns.find((c) => c.status === data.columnStatus);
      const item = (col?.items ?? []).find((i) => i.id === data.itemId);
      if (item) setActive({ item, columnStatus: data.columnStatus });
    },
    [columns, setIsDragging],
  );

  const onDragOver = useCallback(
    ({ active: a, over }: DragOverEvent) => {
      if (!over || !a.data.current) return;

      const activeData = a.data.current as {
        type: "board-card";
        itemId: string;
        columnStatus: WorkItemStatus;
      };
      if (activeData.type !== "board-card") return;

      const overData = over.data.current as
        | { type: "board-card"; itemId: string; columnStatus: WorkItemStatus }
        | { type: "column-drop"; columnStatus: WorkItemStatus }
        | undefined;
      if (!overData) return;

      const srcStatus = activeData.columnStatus;
      const itemId = activeData.itemId;

      // Determine destination column + index
      let dstStatus: WorkItemStatus;
      let dstIndex: number;

      if (overData.type === "column-drop") {
        dstStatus = overData.columnStatus;
        const dstCol = columns.find((c) => c.status === dstStatus);
        dstIndex = (dstCol?.items ?? []).length;
      } else if (overData.type === "board-card") {
        dstStatus = overData.columnStatus;
        const dstCol = columns.find((c) => c.status === dstStatus);
        const dstItems = dstCol?.items ?? [];
        const overIdx = dstItems.findIndex((i) => i.id === over.id);
        dstIndex = overIdx >= 0 ? overIdx : dstItems.length;
      } else {
        return;
      }

      // Same-column reordering is handled in onDragEnd
      if (srcStatus === dstStatus) return;

      useBoardStore.getState().moveItem(itemId, srcStatus, dstStatus, dstIndex);

      // Keep active.columnStatus in sync for subsequent drag-over events
      setActive((prev) =>
        prev ? { ...prev, columnStatus: dstStatus } : prev,
      );
    },
    [columns],
  );

  const onDragEnd = useCallback(
    ({ active: a, over }: DragEndEvent) => {
      setIsDragging(false);
      setActive(null);

      if (!over || !a.data.current) return;

      const activeData = a.data.current as {
        type: "board-card";
        itemId: string;
        columnStatus: WorkItemStatus;
      };
      if (activeData.type !== "board-card") return;

      // After drag-over the item may already be in its new column
      const currentCol = findColumnContainingItem(a.id as string);
      if (!currentCol) return;

      const overData = over.data.current as
        | { type: "board-card"; itemId: string; columnStatus: WorkItemStatus }
        | { type: "column-drop"; columnStatus: WorkItemStatus }
        | undefined;

      let dstStatus: WorkItemStatus;
      let dstIndex: number;

      if (overData?.type === "board-card") {
        dstStatus = overData.columnStatus;
        const dstCol = columns.find((c) => c.status === dstStatus);
        const dstItems = dstCol?.items ?? [];
        dstIndex = dstItems.findIndex((i) => i.id === over.id);
        if (dstIndex === -1) dstIndex = dstItems.length;
      } else if (overData?.type === "column-drop") {
        dstStatus = overData.columnStatus;
        const dstCol = columns.find((c) => c.status === dstStatus);
        dstIndex = (dstCol?.items ?? []).length;
      } else {
        return;
      }

      const srcStatus = activeData.columnStatus;

      moveItem.mutate({
        itemId: a.id as string,
        newStatus: dstStatus,
        srcStatus,
        dstStatus,
        dstIndex,
        sprintId,
      });
    },
    [columns, findColumnContainingItem, moveItem, setIsDragging, sprintId],
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
    >
      <div className="flex gap-4 h-full items-start pb-4">
        <SortableContext
          items={columnStatuses}
          strategy={horizontalListSortingStrategy}
        >
          {columns.map((col) => (
            <BoardColumn
              key={col.status}
              status={col.status}
              label={col.label}
              accentClass={col.accentClass}
              items={col.items ?? []}
              sprintId={sprintId}
            />
          ))}
        </SortableContext>
      </div>

      {typeof window !== "undefined" &&
        createPortal(
          <DragOverlay dropAnimation={{ duration: 180, easing: "ease" }}>
            {active && (
              <BoardCard
                item={active.item}
                columnStatus={active.columnStatus}
                isOverlay
              />
            )}
          </DragOverlay>,
          document.body,
        )}
    </DndContext>
  );
}
