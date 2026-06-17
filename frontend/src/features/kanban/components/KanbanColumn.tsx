"use client";

import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDroppable } from "@dnd-kit/core";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { KanbanColumn as KanbanColumnType } from "../types";
import { KanbanCard } from "./KanbanCard";
import { useKanbanStore } from "../store";

// ─── Column ───────────────────────────────────────────────────────────────────

interface KanbanColumnProps {
  column: KanbanColumnType;
}

export function KanbanColumn({ column }: KanbanColumnProps) {
  const { openAddCard } = useKanbanStore();

  const tasks = column.tasks ?? [];
  const taskIds = tasks.map((t) => t.id);

  // Sortable for column-level drag-and-drop (visual only — column order is fixed)
  const {
    setNodeRef: colRef,
    transform: colTransform,
    transition: colTransition,
    isDragging: colIsDragging,
  } = useSortable({
    id: column.id,
    data: { type: "column" },
  });

  // Also a drop zone for cards
  const { setNodeRef: dropRef, isOver } = useDroppable({
    id: `droppable-${column.id}`,
    data: { type: "column-drop", columnId: column.id },
  });

  const colStyle = {
    transform: CSS.Transform.toString(colTransform),
    transition: colTransition,
  };

  const accentStyle = column.color
    ? { borderTopColor: column.color }
    : {};

  return (
    <div
      ref={colRef}
      style={{ ...colStyle, ...accentStyle }}
      className={cn(
        "flex flex-col w-72 flex-shrink-0 rounded-xl border bg-muted/40",
        "border-t-2",
        colIsDragging && "opacity-50 shadow-none",
      )}
    >
      {/* Column header */}
      <div className="flex items-center gap-1 px-3 pt-3 pb-2">
        {/* Title + count */}
        <h3 className="flex-1 text-sm font-semibold text-foreground truncate">
          {column.title}
        </h3>
        <span className="text-xs text-muted-foreground bg-muted rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center">
          {tasks.length}
        </span>
      </div>

      {/* Card list */}
      <ScrollArea className="flex-1 px-3 pb-2 min-h-[80px]">
        <div
          ref={dropRef}
          className={cn(
            "space-y-2 rounded-lg min-h-[80px] transition-colors",
            isOver && "bg-primary/5 ring-2 ring-primary/20",
          )}
        >
          <SortableContext
            items={taskIds}
            strategy={verticalListSortingStrategy}
          >
            {tasks.map((task) => (
              <KanbanCard key={task.id} task={task} columnId={column.id} />
            ))}
          </SortableContext>

          {tasks.length === 0 && (
            <div
              className={cn(
                "flex items-center justify-center h-20 rounded-md border border-dashed",
                "text-xs text-muted-foreground transition-colors",
                isOver && "border-primary/40 text-primary/60",
              )}
            >
              Drop cards here
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Add card button */}
      <div className="px-3 pb-3 pt-1">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground hover:text-foreground h-8 text-xs"
          onClick={() => openAddCard(column.id)}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add card
        </Button>
      </div>
    </div>
  );
}
