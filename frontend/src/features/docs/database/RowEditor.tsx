"use client";

import React from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DatabaseColumn, DatabaseRow } from "@/types";
import { CellRenderer } from "./CellRenderer";
import { ColTypeIcon } from "./ColumnManager";

interface RowEditorProps {
  row: DatabaseRow;
  columns: DatabaseColumn[];
  onSave: (values: Record<string, unknown>) => void;
  onClose: () => void;
  isSaving?: boolean;
}

/**
 * Modal/panel for editing all fields of a single row.
 * Used when clicking the "open" icon on a table row.
 */
export function RowEditor({ row, columns, onSave, onClose, isSaving }: RowEditorProps) {
  const [values, setValues] = React.useState<Record<string, unknown>>(
    row.values ? { ...row.values } : {},
  );
  const [editingColId, setEditingColId] = React.useState<string | null>(null);

  function handleChange(colId: string, v: unknown) {
    setValues((prev) => ({ ...prev, [colId]: v }));
  }

  function handleSave() {
    onSave(values);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <span className="font-semibold text-sm">Edit row</span>
          <button className="p-1 hover:bg-accent rounded" onClick={onClose}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Fields */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {(columns ?? []).map((col) => (
            <div key={col.id} className="space-y-1">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <ColTypeIcon type={col.type} />
                {col.name}
              </label>
              <div
                className={cn(
                  "min-h-[36px] border border-input rounded-md px-3 py-2 text-sm cursor-text relative",
                  editingColId === col.id && "ring-1 ring-ring",
                )}
                onClick={() => setEditingColId(col.id)}
              >
                <CellRenderer
                  value={values[col.id]}
                  type={col.type}
                  options={col.options ?? []}
                  editing={editingColId === col.id}
                  onChange={(v) => handleChange(col.id, v)}
                  onBlur={() => setEditingColId(null)}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}
