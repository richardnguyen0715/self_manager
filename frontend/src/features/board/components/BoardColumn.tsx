"use client";

import { useState, useRef } from "react";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import type { WorkItemListItem, WorkItemStatus } from "@/types";
import { BoardCard } from "./BoardCard";
import { useBoardStore } from "../store";
import { useCreateBoardItem } from "../hooks/useSprintBoard";

// ─── Column header colour map ─────────────────────────────────────────────────

interface BoardColumnProps {
  status: WorkItemStatus;
  label: string;
  accentClass: string;
  items: WorkItemListItem[];
  sprintId: string;
}

// ─── Quick-create inline form ─────────────────────────────────────────────────

interface QuickCreateProps {
  status: WorkItemStatus;
  sprintId: string;
  onClose: () => void;
}

function QuickCreateForm({ status, sprintId, onClose }: QuickCreateProps) {
  const [title, setTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const create = useCreateBoardItem(sprintId);

  function handleSubmit() {
    const trimmed = title.trim();
    if (!trimmed) {
      onClose();
      return;
    }
    create.mutate(
      { title: trimmed, status, sprint_id: sprintId },
      { onSuccess: () => { setTitle(""); onClose(); } },
    );
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleSubmit();
    if (e.key === "Escape") onClose();
  }

  return (
    <div className="rounded-lg border bg-card shadow-sm px-3 py-2 space-y-2">
      <input
        ref={inputRef}
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Work item title…"
        className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          className="h-7 text-xs"
          onClick={handleSubmit}
          disabled={create.isPending || !title.trim()}
        >
          {create.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            "Add"
          )}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs"
          onClick={onClose}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

// ─── Column ───────────────────────────────────────────────────────────────────

export function BoardColumn({
  status,
  label,
  accentClass,
  items,
  sprintId,
}: BoardColumnProps) {
  const { openCreateInColumn, closeCreateInColumn, creatingInColumnStatus } =
    useBoardStore();

  const isCreating = creatingInColumnStatus === status;

  const itemIds = (items ?? []).map((i) => i.id);

  // Column itself is a drop zone for cards dragged from another column
  const { setNodeRef: dropRef, isOver } = useDroppable({
    id: `column-drop-${status}`,
    data: { type: "column-drop", columnStatus: status },
  });

  return (
    <div
      className={cn(
        "flex flex-col w-72 flex-shrink-0 rounded-xl border bg-muted/40",
        "border-t-[3px]",
        accentClass,
      )}
    >
      {/* Column header */}
      <div className="flex items-center gap-1.5 px-3 pt-3 pb-2">
        <h3 className="flex-1 text-xs font-semibold uppercase tracking-wide text-foreground truncate">
          {label}
        </h3>
        <span className="text-xs text-muted-foreground bg-muted rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center tabular-nums">
          {(items ?? []).length}
        </span>
      </div>

      {/* Card list */}
      <ScrollArea className="flex-1 px-3 pb-1 min-h-[80px]">
        <div
          ref={dropRef}
          className={cn(
            "space-y-2 rounded-lg min-h-[80px] transition-colors pb-1",
            isOver && "bg-primary/5 ring-2 ring-inset ring-primary/20",
          )}
        >
          <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
            {(items ?? []).map((item) => (
              <BoardCard key={item.id} item={item} columnStatus={status} />
            ))}
          </SortableContext>

          {(items ?? []).length === 0 && !isCreating && (
            <div
              className={cn(
                "flex items-center justify-center h-20 rounded-md border border-dashed",
                "text-xs text-muted-foreground transition-colors",
                isOver && "border-primary/40 text-primary/60",
              )}
            >
              Drop items here
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Quick-create form / add button */}
      <div className="px-3 pb-3 pt-1 space-y-2">
        {isCreating ? (
          <QuickCreateForm
            status={status}
            sprintId={sprintId}
            onClose={closeCreateInColumn}
          />
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground hover:text-foreground h-8 text-xs"
            onClick={() => openCreateInColumn(status)}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add item
          </Button>
        )}
      </div>
    </div>
  );
}
