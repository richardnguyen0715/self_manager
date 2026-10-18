"use client";

import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Loader2, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  useLabels,
  useCreateLabel,
  useUpdateLabel,
  useDeleteLabel,
} from "../hooks/useLabels";
import { LABEL_COLOR_PRESETS, type Label } from "../types";
import { LabelChip } from "./LabelChip";
import { LabelColorSwatches } from "./LabelColorSwatches";

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

/** Full management list: create, rename, recolour and delete labels. */
export function LabelsManager() {
  const { data: labels = [], isLoading, isError } = useLabels();
  const createLabel = useCreateLabel();
  const updateLabel = useUpdateLabel();
  const deleteLabel = useDeleteLabel();
  const confirm = useConfirm();

  const [filter, setFilter] = useState("");
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<string>(LABEL_COLOR_PRESETS[5]);
  const [formError, setFormError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  // Set by Escape / Cancel so the blur that follows does not save the rename.
  const renameCancelled = useRef(false);
  const [recolorId, setRecolorId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? labels.filter((l) => l.name.toLowerCase().includes(q)) : labels;
  }, [labels, filter]);

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    setFormError(null);
    try {
      await createLabel.mutateAsync({ name, color: newColor, project_id: null });
      setNewName("");
    } catch (err) {
      setFormError(errorMessage(err, "Could not create label"));
    }
  }

  function startRename(label: Label) {
    setRecolorId(null);
    setRowError(null);
    renameCancelled.current = false;
    setEditingId(label.id);
    setDraftName(label.name);
  }

  function cancelRename() {
    renameCancelled.current = true;
    setEditingId(null);
  }

  async function saveRename(label: Label) {
    if (renameCancelled.current) return;
    const name = draftName.trim();
    if (!name || name === label.name) {
      setEditingId(null);
      return;
    }
    setRowError(null);
    try {
      await updateLabel.mutateAsync({ id: label.id, name });
      setEditingId(null);
    } catch (err) {
      setRowError({ id: label.id, message: errorMessage(err, "Could not rename label") });
    }
  }

  async function changeColor(label: Label, color: string) {
    if (color.toLowerCase() === label.color.toLowerCase()) return;
    setRowError(null);
    try {
      await updateLabel.mutateAsync({ id: label.id, color });
    } catch (err) {
      setRowError({ id: label.id, message: errorMessage(err, "Could not change colour") });
    }
  }

  async function handleDelete(label: Label) {
    const ok = await confirm({
      title: `Delete label "${label.name}"?`,
      description:
        "It will be removed from every work item that uses it. This cannot be undone.",
      confirmText: "Delete label",
      destructive: true,
    });
    if (!ok) return;
    setRowError(null);
    try {
      await deleteLabel.mutateAsync(label.id);
    } catch (err) {
      setRowError({ id: label.id, message: errorMessage(err, "Could not delete label") });
    }
  }

  function onRenameKey(e: KeyboardEvent<HTMLInputElement>, label: Label) {
    if (e.key === "Enter") {
      e.preventDefault();
      void saveRename(label);
    } else if (e.key === "Escape") {
      cancelRename();
    }
  }

  return (
    <div className="space-y-5">
      {/* Create */}
      <div className="rounded-lg border p-3 space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            value={newName}
            onChange={(e) => {
              setNewName(e.target.value);
              setFormError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleCreate();
              }
            }}
            placeholder="New label name"
            maxLength={50}
            aria-label="New label name"
            className="h-9 flex-1 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button
            type="button"
            size="sm"
            onClick={() => void handleCreate()}
            disabled={!newName.trim() || createLabel.isPending}
            className="h-9"
          >
            {createLabel.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Create
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <LabelColorSwatches value={newColor} onChange={setNewColor} />
          {newName.trim() && (
            <LabelChip name={newName.trim()} color={newColor} />
          )}
        </div>
        {formError && (
          <p role="alert" className="text-xs text-destructive">
            {formError}
          </p>
        )}
      </div>

      {/* Filter */}
      {labels.length > 5 && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter labels"
            aria-label="Filter labels"
            className="h-9 w-full rounded-md border bg-background pl-8 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      )}

      {/* List */}
      {isLoading && <p className="text-sm text-muted-foreground">Loading labels...</p>}
      {isError && <p className="text-sm text-destructive">Could not load labels.</p>}
      {!isLoading && !isError && labels.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No labels yet. Create one above, or add one from a work item.
        </p>
      )}

      <ul className="divide-y rounded-lg border">
        {visible.map((label) => {
          const isEditing = editingId === label.id;
          const isRecoloring = recolorId === label.id;
          const error = rowError?.id === label.id ? rowError.message : null;
          return (
            <li key={label.id} className="px-3 py-2.5">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setRecolorId(isRecoloring ? null : label.id)}
                  className="h-4 w-4 shrink-0 rounded-full ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  style={{ backgroundColor: label.color }}
                  aria-label={`Change colour of ${label.name}`}
                  aria-expanded={isRecoloring}
                  title="Change colour"
                />

                {isEditing ? (
                  <input
                    autoFocus
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    onKeyDown={(e) => onRenameKey(e, label)}
                    onBlur={() => void saveRename(label)}
                    maxLength={50}
                    aria-label={`Rename ${label.name}`}
                    className="h-8 flex-1 min-w-0 rounded-md border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                ) : (
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="truncate text-sm font-medium">{label.name}</span>
                    <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {label.project_id ? "Project" : "Global"}
                    </span>
                  </div>
                )}

                <div className="flex shrink-0 items-center gap-1">
                  {isEditing ? (
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={cancelRename}
                      className="rounded p-1.5 text-muted-foreground hover:bg-accent"
                      aria-label="Cancel rename"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => startRename(label)}
                      className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                      aria-label={`Rename ${label.name}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleDelete(label)}
                    disabled={deleteLabel.isPending}
                    className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                    aria-label={`Delete ${label.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {isRecoloring && (
                <div className="mt-2 pl-7">
                  <LabelColorSwatches
                    value={label.color}
                    onChange={(color) => void changeColor(label, color)}
                  />
                </div>
              )}

              {error && (
                <p role="alert" className="mt-1.5 pl-7 text-xs text-destructive">
                  {error}
                </p>
              )}
            </li>
          );
        })}
        {labels.length > 0 && visible.length === 0 && (
          <li className="px-3 py-3 text-sm text-muted-foreground">No labels match this filter.</li>
        )}
      </ul>
    </div>
  );
}
