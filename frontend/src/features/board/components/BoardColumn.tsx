"use client";

import { useState, useRef } from "react";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDroppable } from "@dnd-kit/core";
import {
  Plus,
  Loader2,
  MoreHorizontal,
  Pencil,
  Palette,
  Trash2,
  GripVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import type { WorkItemListItem } from "@/types";
import { BoardCard } from "./BoardCard";
import { useBoardStore, type BoardColumn as BoardColumnState } from "../store";
import {
  useCreateBoardItem,
  useUpdateColumn,
  useDeleteColumn,
} from "../hooks/useSprintBoard";

// ─── Quick-create inline form ─────────────────────────────────────────────────

interface QuickCreateProps {
  columnId: string;
  mappedStatus: string | null;
  sprintId: string;
  onClose: () => void;
}

function QuickCreateForm({
  columnId,
  mappedStatus,
  sprintId,
  onClose,
}: QuickCreateProps) {
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
      {
        title: trimmed,
        status: (mappedStatus as "backlog" | "todo" | "in_progress" | "review" | "done") ?? "todo",
        sprint_id: sprintId,
      },
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
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

// ─── Inline rename form ───────────────────────────────────────────────────────

interface RenameFormProps {
  columnId: string;
  currentName: string;
  onClose: () => void;
}

function RenameForm({ columnId, currentName, onClose }: RenameFormProps) {
  const [value, setValue] = useState(currentName);
  const updateColumn = useUpdateColumn();

  function handleSave() {
    const trimmed = value.trim();
    if (trimmed && trimmed !== currentName) {
      updateColumn.mutate(
        { id: columnId, name: trimmed },
        { onSuccess: onClose },
      );
    } else {
      onClose();
    }
  }

  return (
    <input
      autoFocus
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={handleSave}
      onKeyDown={(e) => {
        if (e.key === "Enter") handleSave();
        if (e.key === "Escape") onClose();
      }}
      className="flex-1 min-w-0 text-xs font-semibold uppercase tracking-wide bg-transparent border-b border-primary outline-none"
    />
  );
}

// ─── Color picker popover ─────────────────────────────────────────────────────

const PRESET_COLORS = [
  "#94a3b8", // slate-400
  "#8b5cf6", // violet-500
  "#0ea5e9", // sky-500
  "#f59e0b", // amber-500
  "#10b981", // emerald-500
  "#ef4444", // red-500
  "#f97316", // orange-500
  "#84cc16", // lime-500
  "#14b8a6", // teal-500
  "#ec4899", // pink-500
  "#6366f1", // indigo-500
  "#a855f7", // purple-500
];

interface ColorPickerProps {
  currentColor: string | null;
  onSelect: (color: string) => void;
}

function ColorPicker({ currentColor, onSelect }: ColorPickerProps) {
  return (
    <div className="p-2 grid grid-cols-6 gap-1.5 w-44">
      {PRESET_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onSelect(c)}
          className={cn(
            "h-5 w-5 rounded-full ring-offset-background transition-all",
            currentColor?.toLowerCase() === c.toLowerCase()
              ? "ring-2 ring-primary ring-offset-1"
              : "hover:scale-110",
          )}
          style={{ backgroundColor: c }}
          aria-label={c}
        />
      ))}
    </div>
  );
}

// ─── Column header menu ───────────────────────────────────────────────────────

interface ColumnMenuProps {
  column: BoardColumnState;
  onRename: () => void;
}

function ColumnMenu({ column, onRename }: ColumnMenuProps) {
  const updateColumn = useUpdateColumn();
  const deleteColumn = useDeleteColumn();
  const [colorSubOpen, setColorSubOpen] = useState(false);

  function handleDelete() {
    if (
      !confirm(
        `Delete column "${column.name}"? Items in it will be moved to the first remaining column.`,
      )
    )
      return;
    deleteColumn.mutate(column.id);
  }

  return (
    <DropdownMenuPrimitive.Root>
      <DropdownMenuPrimitive.Trigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 opacity-0 group-hover/header:opacity-100 transition-opacity"
          aria-label="Column options"
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuPrimitive.Trigger>
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          sideOffset={4}
          align="end"
          className="z-50 min-w-[11rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
        >
          <DropdownMenuPrimitive.Item
            onSelect={onRename}
            className="flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent"
          >
            <Pencil className="h-3.5 w-3.5" />
            Rename
          </DropdownMenuPrimitive.Item>

          {/* Color sub-menu */}
          <DropdownMenuPrimitive.Sub open={colorSubOpen} onOpenChange={setColorSubOpen}>
            <DropdownMenuPrimitive.SubTrigger className="flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent data-[state=open]:bg-accent">
              <Palette className="h-3.5 w-3.5" />
              Color
            </DropdownMenuPrimitive.SubTrigger>
            <DropdownMenuPrimitive.Portal>
              <DropdownMenuPrimitive.SubContent
                sideOffset={6}
                className="z-50 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md"
              >
                <ColorPicker
                  currentColor={column.color}
                  onSelect={(color) => {
                    updateColumn.mutate({ id: column.id, color });
                    setColorSubOpen(false);
                  }}
                />
              </DropdownMenuPrimitive.SubContent>
            </DropdownMenuPrimitive.Portal>
          </DropdownMenuPrimitive.Sub>

          <DropdownMenuPrimitive.Separator className="my-1 h-px bg-border" />

          <DropdownMenuPrimitive.Item
            onSelect={handleDelete}
            className="flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete column
          </DropdownMenuPrimitive.Item>
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Root>
  );
}

// ─── Column ───────────────────────────────────────────────────────────────────

interface BoardColumnProps {
  column: BoardColumnState;
  items: WorkItemListItem[];
  sprintId: string;
}

export function BoardColumn({ column, items, sprintId }: BoardColumnProps) {
  const { openCreateInColumn, closeCreateInColumn, creatingInColumnId } =
    useBoardStore();

  const isCreating = creatingInColumnId === column.id;
  const [renaming, setRenaming] = useState(false);

  const itemIds = (items ?? []).map((i) => i.id);

  // Column drop zone for cards dragged from another column
  const { setNodeRef: dropRef, isOver } = useDroppable({
    id: `column-drop-${column.id}`,
    data: { type: "column-drop", columnId: column.id },
  });

  // Column itself is sortable (for drag-reorder of columns)
  const {
    attributes,
    listeners,
    setNodeRef: sortableRef,
    transform,
    transition,
    isDragging: isColumnDragging,
  } = useSortable({
    id: column.id,
    data: { type: "board-column", columnId: column.id },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={sortableRef}
      style={style}
      className={cn(
        "flex flex-col w-[260px] sm:w-72 min-w-[260px] flex-shrink-0 rounded-xl border bg-muted/40",
        "border-t-[3px]",
        column.accentClass,
        isColumnDragging && "opacity-40 shadow-none",
      )}
    >
      {/* Column header */}
      <div className="group/header flex items-center gap-1.5 px-3 pt-3 pb-2">
        {/* Drag handle for column reorder */}
        <button
          {...attributes}
          {...listeners}
          className={cn(
            "p-0.5 rounded text-muted-foreground/30 hover:text-muted-foreground/70",
            "opacity-0 group-hover/header:opacity-100 transition-opacity cursor-grab active:cursor-grabbing",
          )}
          aria-label="Drag to reorder column"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>

        {renaming ? (
          <RenameForm
            columnId={column.id}
            currentName={column.name}
            onClose={() => setRenaming(false)}
          />
        ) : (
          <h3 className="flex-1 text-xs font-semibold uppercase tracking-wide text-foreground truncate">
            {column.name}
          </h3>
        )}

        {/* WIP limit indicator */}
        {column.wip_limit != null && (
          <span
            className={cn(
              "text-[10px] tabular-nums",
              (items ?? []).length > column.wip_limit
                ? "text-destructive font-semibold"
                : "text-muted-foreground",
            )}
            title={`WIP limit: ${column.wip_limit}`}
          >
            {(items ?? []).length}/{column.wip_limit}
          </span>
        )}

        <Badge
          variant="secondary"
          className="text-xs bg-muted rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center tabular-nums"
        >
          {(items ?? []).length}
        </Badge>

        {!renaming && (
          <ColumnMenu column={column} onRename={() => setRenaming(true)} />
        )}
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
              <BoardCard key={item.id} item={item} columnId={column.id} />
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
            columnId={column.id}
            mappedStatus={column.mapped_status}
            sprintId={sprintId}
            onClose={closeCreateInColumn}
          />
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground hover:text-foreground h-8 text-xs"
            onClick={() => openCreateInColumn(column.id)}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add item
          </Button>
        )}
      </div>
    </div>
  );
}
