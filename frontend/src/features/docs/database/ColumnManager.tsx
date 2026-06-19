"use client";

import React, { useState } from "react";
import {
  Type, Hash, Calendar, CheckSquare, ChevronDown, Tags,
  CircleDot, Link, Plus, Trash2, X, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { DatabaseColumn, DatabaseColumnType, SelectOption } from "@/types";
import {
  COLUMN_TYPE_META,
  ALL_COLUMN_TYPES,
  randomOptionColor,
  newOptionId,
} from "./column-utils";
import {
  useCreateColumn,
  useUpdateColumn,
  useDeleteColumn,
} from "@/features/docs/hooks/useDocs";

// ─── Icon map ─────────────────────────────────────────────────────────────────

const ICON_MAP = {
  Type, Hash, Calendar, CheckSquare, ChevronDown, Tags, CircleDot, Link,
} as const;

function ColTypeIcon({ type }: { type: DatabaseColumnType }) {
  const meta = COLUMN_TYPE_META[type];
  const Icon = ICON_MAP[meta.icon as keyof typeof ICON_MAP] ?? Type;
  return <Icon className="w-3.5 h-3.5 shrink-0" />;
}

// ─── Column header context menu ───────────────────────────────────────────────

interface ColumnMenuProps {
  dbId: string;
  column: DatabaseColumn;
  onClose: () => void;
}

export function ColumnMenu({ dbId, column, onClose }: ColumnMenuProps) {
  const [name, setName] = useState(column.name);
  const [type, setType] = useState<DatabaseColumnType>(column.type);
  const [options, setOptions] = useState<SelectOption[]>(column.options ?? []);
  const [newOptName, setNewOptName] = useState("");
  const [showTypePicker, setShowTypePicker] = useState(false);

  const updateColumn = useUpdateColumn(dbId);
  const deleteColumn = useDeleteColumn(dbId);

  const hasDirtyMeta = name !== column.name || type !== column.type;
  const hasDirtyOptions = JSON.stringify(options) !== JSON.stringify(column.options ?? []);

  function save() {
    if (!hasDirtyMeta && !hasDirtyOptions) { onClose(); return; }
    updateColumn.mutate(
      {
        colId: column.id,
        payload: {
          name: name.trim() || column.name,
          type,
          ...(COLUMN_TYPE_META[type].hasOptions ? { options } : {}),
        },
      },
      { onSuccess: onClose },
    );
  }

  function addOption() {
    if (!newOptName.trim()) return;
    setOptions((prev) => [
      ...prev,
      { id: newOptionId(), name: newOptName.trim(), color: randomOptionColor() },
    ]);
    setNewOptName("");
  }

  function removeOption(id: string) {
    setOptions((prev) => prev.filter((o) => o.id !== id));
  }

  function deleteCol() {
    deleteColumn.mutate(column.id, { onSuccess: onClose });
  }

  return (
    <div
      className="w-72 bg-popover border border-border rounded-lg shadow-lg p-3 space-y-3"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Name */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">
          Column name
        </label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-8 text-sm"
          onKeyDown={(e) => { if (e.key === "Enter") save(); }}
        />
      </div>

      {/* Type picker */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">
          Property type
        </label>
        <button
          className={cn(
            "w-full flex items-center gap-2 px-3 py-1.5 rounded border border-input text-sm bg-background hover:bg-accent",
          )}
          onClick={() => setShowTypePicker((v) => !v)}
        >
          <ColTypeIcon type={type} />
          {COLUMN_TYPE_META[type].label}
          <ChevronDown className="ml-auto w-3.5 h-3.5 text-muted-foreground" />
        </button>
        {showTypePicker && (
          <div className="mt-1 border border-border rounded-md overflow-hidden bg-popover shadow-sm">
            {ALL_COLUMN_TYPES.map((t) => (
              <button
                key={t}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent",
                  type === t && "bg-accent/50",
                )}
                onClick={() => { setType(t); setShowTypePicker(false); }}
              >
                <ColTypeIcon type={t} />
                {COLUMN_TYPE_META[t].label}
                {type === t && <Check className="ml-auto w-3.5 h-3.5 text-primary" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Options for select / multi_select / status */}
      {COLUMN_TYPE_META[type].hasOptions && (
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            Options
          </label>
          <div className="space-y-1 max-h-40 overflow-y-auto mb-2">
            {(options ?? []).map((opt) => (
              <div key={opt.id} className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: opt.color }}
                />
                <span className="text-sm flex-1 truncate">{opt.name}</span>
                <button
                  className="p-0.5 hover:text-destructive text-muted-foreground"
                  onClick={() => removeOption(opt.id)}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <Input
              placeholder="Add option"
              value={newOptName}
              onChange={(e) => setNewOptName(e.target.value)}
              className="h-7 text-xs flex-1"
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addOption(); } }}
            />
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={addOption}>
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-1 border-t border-border">
        <button
          className="flex items-center gap-1.5 text-xs text-destructive hover:text-destructive/80"
          onClick={deleteCol}
          disabled={deleteColumn.isPending}
        >
          <Trash2 className="w-3.5 h-3.5" />
          Delete
        </button>
        <div className="flex gap-1.5">
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs"
            onClick={save}
            disabled={updateColumn.isPending || (!hasDirtyMeta && !hasDirtyOptions)}
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Add column button / inline creator ──────────────────────────────────────

interface AddColumnButtonProps {
  dbId: string;
  nextPosition: number;
}

export function AddColumnButton({ dbId, nextPosition }: AddColumnButtonProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<DatabaseColumnType>("text");

  const createColumn = useCreateColumn(dbId);

  function submit() {
    if (!name.trim()) return;
    createColumn.mutate(
      { name: name.trim(), type, position: nextPosition },
      {
        onSuccess: () => {
          setName("");
          setType("text");
          setOpen(false);
        },
      },
    );
  }

  if (!open) {
    return (
      <button
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded"
        onClick={() => setOpen(true)}
      >
        <Plus className="w-3.5 h-3.5" />
        Add column
      </button>
    );
  }

  return (
    <div
      className="absolute z-50 top-full left-0 mt-1 w-60 bg-popover border border-border rounded-lg shadow-lg p-3 space-y-2"
      onClick={(e) => e.stopPropagation()}
    >
      <Input
        autoFocus
        placeholder="Column name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="h-8 text-sm"
        onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") setOpen(false); }}
      />
      <div className="flex flex-wrap gap-1">
        {ALL_COLUMN_TYPES.map((t) => (
          <button
            key={t}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded border text-xs",
              type === t
                ? "border-primary bg-primary/10 text-primary"
                : "border-input text-muted-foreground hover:border-input/80",
            )}
            onClick={() => setType(t)}
          >
            <ColTypeIcon type={t} />
            {COLUMN_TYPE_META[t].label}
          </button>
        ))}
      </div>
      <div className="flex gap-1.5">
        <Button variant="ghost" size="sm" className="flex-1 h-7 text-xs" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button
          size="sm"
          className="flex-1 h-7 text-xs"
          onClick={submit}
          disabled={!name.trim() || createColumn.isPending}
        >
          Add
        </Button>
      </div>
    </div>
  );
}

// ─── Export icons for TableView header use ────────────────────────────────────
export { ColTypeIcon };
