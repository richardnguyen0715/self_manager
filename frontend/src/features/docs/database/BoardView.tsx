"use client";

import React, { useState, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  DatabaseColumn,
  DatabaseRow,
  DatabaseView,
  DatabaseViewConfig,
  BoardGroup,
  SelectOption,
} from "@/types";
import {
  useCreateRow,
  useUpdateRow,
  useBatchUpdateRows,
  useUpdateView,
} from "@/features/docs/hooks/useDocs";
import { RowEditor } from "./RowEditor";

interface BoardViewProps {
  dbId: string;
  view: DatabaseView;
  columns: DatabaseColumn[];
  groups: BoardGroup[];
}

export function BoardView({ dbId, view, columns, groups }: BoardViewProps) {
  const safeGroups = groups ?? [];
  const safeColumns = columns ?? [];

  const config: DatabaseViewConfig = view.config ?? {};
  const groupByColId = config.group_by_column_id;

  const groupByColumn = safeColumns.find((c) => c.id === groupByColId);

  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);

  const createRow = useCreateRow(dbId);
  const batchUpdate = useBatchUpdateRows(dbId);
  const updateRow = useUpdateRow(dbId);
  const updateView = useUpdateView(dbId);

  // Flat lookup: rowId → groupOptionId
  const rowGroupMap = React.useMemo(() => {
    const map = new Map<string, string | null>();
    for (const g of safeGroups) {
      for (const r of g.rows ?? []) {
        map.set(r.id, g.option_id);
      }
    }
    return map;
  }, [safeGroups]);

  // Active row for overlay
  const activeRow = React.useMemo(() => {
    for (const g of safeGroups) {
      const r = (g.rows ?? []).find((r) => r.id === activeRowId);
      if (r) return r;
    }
    return null;
  }, [activeRowId, safeGroups]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveRowId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveRowId(null);
    const { active, over } = event;
    if (!over) return;

    const rowId = String(active.id);
    // over.id is either a row id (same/different group) or a group container id
    const overId = String(over.id);

    const fromGroupId = rowGroupMap.get(rowId);

    // Determine target group: over.id could be a group prefix or row id
    let toGroupId: string | null | undefined;

    if (overId.startsWith("group:")) {
      // Dropped on a group column container
      const rawGroupId = overId.slice("group:".length);
      toGroupId = rawGroupId === "null" ? null : rawGroupId;
    } else {
      // Dropped on another row — use that row's group
      toGroupId = rowGroupMap.get(overId);
    }

    if (toGroupId === undefined || toGroupId === fromGroupId) return;

    // Build the new values update for the moved row
    if (!groupByColId) return;

    batchUpdate.mutate({
      updates: [
        {
          id: rowId,
          values: { [groupByColId]: toGroupId },
        },
      ],
    });
  }

  // Group column not set — prompt to pick one
  if (!groupByColId) {
    const selectColumns = safeColumns.filter(
      (c) => c.type === "select" || c.type === "status",
    );

    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8 text-muted-foreground">
        <p className="text-sm mb-4">
          Board view needs a <strong>Select</strong> or <strong>Status</strong> column to group by.
        </p>
        {selectColumns.length === 0 ? (
          <p className="text-xs">Add a Select or Status column first.</p>
        ) : (
          <div className="flex flex-col gap-2 items-center">
            <p className="text-xs mb-2">Pick a column to group by:</p>
            {selectColumns.map((col) => (
              <button
                key={col.id}
                className="px-4 py-2 rounded border border-input hover:bg-accent text-sm"
                onClick={() =>
                  updateView.mutate({
                    viewId: view.id,
                    payload: {
                      config: { ...config, group_by_column_id: col.id },
                    },
                  })
                }
              >
                {col.name}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  const editingRow = editingRowId
    ? safeGroups.flatMap((g) => g.rows ?? []).find((r) => r.id === editingRowId)
    : null;

  return (
    <div className="flex-1 overflow-x-auto overflow-y-hidden">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 h-full p-4 items-start min-h-0">
          {safeGroups.map((group) => (
            <BoardColumn
              key={group.option_id ?? "null"}
              group={group}
              groupByColumn={groupByColumn}
              dbId={dbId}
              groupByColId={groupByColId}
              columns={safeColumns}
              onOpenRow={(id) => setEditingRowId(id)}
              onAddRow={() =>
                createRow.mutate({
                  values: groupByColId
                    ? { [groupByColId]: group.option_id }
                    : {},
                })
              }
            />
          ))}
        </div>

        <DragOverlay>
          {activeRow ? (
            <BoardCardOverlay row={activeRow} columns={safeColumns} />
          ) : null}
        </DragOverlay>
      </DndContext>

      {editingRow && (
        <RowEditor
          row={editingRow}
          columns={safeColumns}
          isSaving={updateRow.isPending}
          onSave={(values) =>
            updateRow.mutate(
              { rowId: editingRow.id, payload: { values } },
              { onSuccess: () => setEditingRowId(null) },
            )
          }
          onClose={() => setEditingRowId(null)}
        />
      )}
    </div>
  );
}

// ─── Board column ─────────────────────────────────────────────────────────────

interface BoardColumnProps {
  group: BoardGroup;
  groupByColumn: DatabaseColumn | undefined;
  dbId: string;
  groupByColId: string;
  columns: DatabaseColumn[];
  onOpenRow: (id: string) => void;
  onAddRow: () => void;
}

function BoardColumn({
  group,
  groupByColumn,
  dbId,
  groupByColId,
  columns,
  onOpenRow,
  onAddRow,
}: BoardColumnProps) {
  const safeRows = group.rows ?? [];
  const rowIds = safeRows.map((r) => r.id);

  // Color from the select option
  const option = (groupByColumn?.options ?? []).find(
    (o: SelectOption) => o.id === group.option_id,
  );
  const color = option?.color ?? "#9CA3AF";

  return (
    <div
      id={`group:${group.option_id ?? "null"}`}
      className="flex flex-col w-72 flex-shrink-0 bg-muted/30 rounded-xl border border-border min-h-[200px] max-h-[calc(100vh-220px)] overflow-hidden"
    >
      {/* Group header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
        <span
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: color }}
        />
        <span className="font-medium text-sm flex-1 truncate">{group.option_name}</span>
        <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
          {safeRows.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        <SortableContext items={rowIds} strategy={verticalListSortingStrategy}>
          {safeRows.map((row) => (
            <BoardCard
              key={row.id}
              row={row}
              columns={columns}
              onOpen={() => onOpenRow(row.id)}
            />
          ))}
        </SortableContext>
      </div>

      {/* Add card */}
      <div className="px-2 py-2 border-t border-border">
        <button
          className="w-full flex items-center gap-1.5 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded"
          onClick={onAddRow}
        >
          <Plus className="w-3.5 h-3.5" />
          Add card
        </button>
      </div>
    </div>
  );
}

// ─── Board card ────────────────────────────────────────────────────────────────

interface BoardCardProps {
  row: DatabaseRow;
  columns: DatabaseColumn[];
  onOpen: () => void;
}

function BoardCard({ row, columns, onOpen }: BoardCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: row.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Show first 3 non-empty values as preview
  const preview = (columns ?? [])
    .filter((c) => {
      const v = (row.values ?? {})[c.id];
      return v !== undefined && v !== null && v !== "";
    })
    .slice(0, 3);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "bg-background border border-border rounded-lg p-3 cursor-pointer hover:shadow-md transition-shadow group",
        isDragging && "opacity-30",
      )}
      onClick={onOpen}
    >
      <div className="flex items-start gap-2">
        <div
          {...attributes}
          {...listeners}
          className="p-0.5 -ml-1 opacity-0 group-hover:opacity-100 cursor-grab text-muted-foreground hover:text-foreground transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="w-3.5 h-3.5" />
        </div>
        <div className="flex-1 min-w-0 space-y-1.5">
          {preview.map((col) => {
            const val = (row.values ?? {})[col.id];
            return (
              <div key={col.id}>
                {col.type === "text" || col.type === "url" ? (
                  <p className="text-sm font-medium truncate">{String(val)}</p>
                ) : col.type === "select" || col.type === "status" ? (
                  (() => {
                    const opt = (col.options ?? []).find((o: SelectOption) => o.id === val);
                    return opt ? (
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white"
                        style={{ backgroundColor: opt.color || "#6B7280" }}
                      >
                        {opt.name}
                      </span>
                    ) : null;
                  })()
                ) : col.type === "checkbox" ? (
                  <span className="text-xs text-muted-foreground">
                    {val ? "Checked" : "Unchecked"}
                  </span>
                ) : (
                  <p className="text-xs text-muted-foreground truncate">{String(val)}</p>
                )}
              </div>
            );
          })}
          {preview.length === 0 && (
            <p className="text-xs text-muted-foreground italic">Empty card</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Drag overlay card ────────────────────────────────────────────────────────

function BoardCardOverlay({
  row,
  columns,
}: {
  row: DatabaseRow;
  columns: DatabaseColumn[];
}) {
  return (
    <div className="bg-background border border-primary rounded-lg p-3 w-64 shadow-2xl opacity-90">
      <div className="space-y-1.5">
        {(columns ?? [])
          .filter((c) => {
            const v = (row.values ?? {})[c.id];
            return v !== undefined && v !== null && v !== "";
          })
          .slice(0, 2)
          .map((col) => (
            <p key={col.id} className="text-sm truncate">
              {String((row.values ?? {})[col.id])}
            </p>
          ))}
      </div>
    </div>
  );
}
