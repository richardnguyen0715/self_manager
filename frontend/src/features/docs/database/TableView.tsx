"use client";

import React, { useState, useRef, useCallback } from "react";
import { Plus, Expand, ChevronDown, Eye, EyeOff, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DatabaseColumn, DatabaseRow, DatabaseView, DatabaseViewConfig } from "@/types";
import { CellRenderer } from "./CellRenderer";
import { ColumnMenu, AddColumnButton, ColTypeIcon } from "./ColumnManager";
import { RowEditor } from "./RowEditor";
import {
  useCreateRow,
  useUpdateRow,
  useDeleteRow,
  useUpdateView,
} from "@/features/docs/hooks/useDocs";

interface TableViewProps {
  dbId: string;
  view: DatabaseView;
  columns: DatabaseColumn[];
  rows: DatabaseRow[];
}

export function TableView({ dbId, view, columns, rows }: TableViewProps) {
  const safeColumns = columns ?? [];
  const safeRows = rows ?? [];

  const config: DatabaseViewConfig = view.config ?? {};
  const columnOrder: string[] = config.column_order ?? safeColumns.map((c) => c.id);
  const hiddenIds: string[] = config.hidden_column_ids ?? [];

  // Columns ordered by config.column_order, visible first
  const orderedColumns = [...safeColumns].sort((a, b) => {
    const ai = columnOrder.indexOf(a.id);
    const bi = columnOrder.indexOf(b.id);
    return (ai === -1 ? 9999 : ai) - (bi === -1 ? 9999 : bi);
  });
  const visibleColumns = orderedColumns.filter((c) => !hiddenIds.includes(c.id));

  const [editingCell, setEditingCell] = useState<{ rowId: string; colId: string } | null>(null);
  const [editingRowId, setEditingRowId] = useState<string | null>(null); // for RowEditor modal
  const [columnMenuId, setColumnMenuId] = useState<string | null>(null);
  const [showHiddenPanel, setShowHiddenPanel] = useState(false);

  const createRow = useCreateRow(dbId);
  const updateRow = useUpdateRow(dbId);
  const deleteRow = useDeleteRow(dbId);
  const updateView = useUpdateView(dbId);

  function handleCellChange(rowId: string, colId: string, value: unknown) {
    const row = safeRows.find((r) => r.id === rowId);
    if (!row) return;
    updateRow.mutate({
      rowId,
      payload: { values: { ...(row.values ?? {}), [colId]: value } },
    });
  }

  function handleAddRow() {
    createRow.mutate({ values: {} });
  }

  function toggleColumnVisibility(colId: string) {
    const newHidden = hiddenIds.includes(colId)
      ? hiddenIds.filter((id) => id !== colId)
      : [...hiddenIds, colId];
    updateView.mutate({
      viewId: view.id,
      payload: { config: { ...config, hidden_column_ids: newHidden } },
    });
  }

  const editingRow = editingRowId ? safeRows.find((r) => r.id === editingRowId) : null;

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar: hidden columns */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
        <div className="relative">
          <button
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-colors",
              hiddenIds.length > 0
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent",
            )}
            onClick={() => setShowHiddenPanel((v) => !v)}
          >
            <Eye className="w-3.5 h-3.5" />
            {hiddenIds.length > 0 ? `${hiddenIds.length} hidden` : "Hide columns"}
          </button>

          {showHiddenPanel && (
            <div className="absolute top-full left-0 mt-1 z-50 w-52 bg-popover border border-border rounded-lg shadow-lg p-2">
              <p className="text-xs font-medium text-muted-foreground px-2 pb-1 mb-1 border-b border-border">
                Toggle columns
              </p>
              {orderedColumns.map((col) => {
                const hidden = hiddenIds.includes(col.id);
                return (
                  <button
                    key={col.id}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent rounded"
                    onClick={() => toggleColumnVisibility(col.id)}
                  >
                    {hidden ? (
                      <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
                    ) : (
                      <Eye className="w-3.5 h-3.5 text-primary" />
                    )}
                    <ColTypeIcon type={col.type} />
                    <span className={cn("flex-1 text-left", hidden && "text-muted-foreground")}>
                      {col.name}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-sm" style={{ minWidth: "max-content" }}>
          <thead>
            <tr className="bg-muted/40 border-b border-border sticky top-0 z-10">
              {/* Row number */}
              <th className="w-10 border-r border-border px-2 py-2 text-xs text-muted-foreground font-normal text-center">
                #
              </th>

              {visibleColumns.map((col) => (
                <ColumnHeader
                  key={col.id}
                  dbId={dbId}
                  column={col}
                  menuOpen={columnMenuId === col.id}
                  onMenuOpen={() => setColumnMenuId(col.id)}
                  onMenuClose={() => setColumnMenuId(null)}
                />
              ))}

              {/* Add column */}
              <th className="border-l border-border px-2 py-2 relative">
                <div className="relative">
                  <AddColumnButton dbId={dbId} nextPosition={safeColumns.length} />
                </div>
              </th>
            </tr>
          </thead>

          <tbody>
            {safeRows.map((row, rowIndex) => (
              <TableRow
                key={row.id}
                row={row}
                rowIndex={rowIndex}
                columns={visibleColumns}
                editingCell={editingCell}
                onCellClick={(colId) => setEditingCell({ rowId: row.id, colId })}
                onCellBlur={() => setEditingCell(null)}
                onCellChange={(colId, value) => handleCellChange(row.id, colId, value)}
                onOpenRow={() => setEditingRowId(row.id)}
                onDeleteRow={() => deleteRow.mutate(row.id)}
              />
            ))}

            {/* Add row */}
            <tr className="border-b border-border hover:bg-accent/30 group">
              <td
                colSpan={visibleColumns.length + 2}
                className="px-4 py-2"
              >
                <button
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                  onClick={handleAddRow}
                  disabled={createRow.isPending}
                >
                  <Plus className="w-3.5 h-3.5" />
                  New row
                </button>
              </td>
            </tr>
          </tbody>
        </table>

        {safeRows.length === 0 && !createRow.isPending && (
          <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
            <p className="text-sm mb-3">No rows yet</p>
            <Button variant="outline" size="sm" onClick={handleAddRow}>
              <Plus className="w-4 h-4 mr-1" />
              Add first row
            </Button>
          </div>
        )}
      </div>

      {/* Row editor modal */}
      {editingRow && (
        <RowEditor
          row={editingRow}
          columns={safeColumns}
          isSaving={updateRow.isPending}
          onSave={(values) => {
            updateRow.mutate(
              { rowId: editingRow.id, payload: { values } },
              { onSuccess: () => setEditingRowId(null) },
            );
          }}
          onClose={() => setEditingRowId(null)}
        />
      )}
    </div>
  );
}

// ─── Column header ────────────────────────────────────────────────────────────

interface ColumnHeaderProps {
  dbId: string;
  column: DatabaseColumn;
  menuOpen: boolean;
  onMenuOpen: () => void;
  onMenuClose: () => void;
}

function ColumnHeader({ dbId, column, menuOpen, onMenuOpen, onMenuClose }: ColumnHeaderProps) {
  const ref = useRef<HTMLTableCellElement>(null);

  return (
    <th
      ref={ref}
      className="relative border-r border-border px-0 py-0 font-normal min-w-[160px] max-w-[300px]"
    >
      <button
        className={cn(
          "w-full h-full flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-accent/50 transition-colors",
          menuOpen && "bg-accent/50",
        )}
        onClick={() => (menuOpen ? onMenuClose() : onMenuOpen())}
      >
        <ColTypeIcon type={column.type} />
        <span className="truncate flex-1 text-left">{column.name}</span>
        <ChevronDown className="w-3 h-3 opacity-50 shrink-0" />
      </button>

      {menuOpen && (
        <div className="absolute top-full left-0 mt-1 z-50">
          <ColumnMenu dbId={dbId} column={column} onClose={onMenuClose} />
        </div>
      )}
    </th>
  );
}

// ─── Table row ────────────────────────────────────────────────────────────────

interface TableRowProps {
  row: DatabaseRow;
  rowIndex: number;
  columns: DatabaseColumn[];
  editingCell: { rowId: string; colId: string } | null;
  onCellClick: (colId: string) => void;
  onCellBlur: () => void;
  onCellChange: (colId: string, value: unknown) => void;
  onOpenRow: () => void;
  onDeleteRow: () => void;
}

function TableRow({
  row,
  rowIndex,
  columns,
  editingCell,
  onCellClick,
  onCellBlur,
  onCellChange,
  onOpenRow,
  onDeleteRow,
}: TableRowProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <tr
      className="border-b border-border hover:bg-accent/20 group"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Row number + expand */}
      <td className="w-10 border-r border-border px-1 py-1 text-center">
        <div className="flex items-center justify-center gap-0.5">
          {hovered ? (
            <button
              className="p-0.5 hover:bg-accent rounded text-muted-foreground hover:text-foreground"
              title="Open row"
              onClick={onOpenRow}
            >
              <Expand className="w-3 h-3" />
            </button>
          ) : (
            <span className="text-xs text-muted-foreground/60">{rowIndex + 1}</span>
          )}
        </div>
      </td>

      {(columns ?? []).map((col) => {
        const isEditing =
          editingCell?.rowId === row.id && editingCell?.colId === col.id;

        return (
          <td
            key={col.id}
            className={cn(
              "border-r border-border px-3 py-1.5 align-middle cursor-pointer relative",
              "min-w-[160px] max-w-[300px]",
              isEditing && "ring-1 ring-inset ring-primary",
            )}
            onClick={() => !isEditing && onCellClick(col.id)}
          >
            <CellRenderer
              value={(row.values ?? {})[col.id]}
              type={col.type}
              options={col.options ?? []}
              editing={isEditing}
              onChange={(v) => onCellChange(col.id, v)}
              onBlur={onCellBlur}
            />
          </td>
        );
      })}

      {/* Empty trailing cell */}
      <td className="px-2 py-1.5" />
    </tr>
  );
}
