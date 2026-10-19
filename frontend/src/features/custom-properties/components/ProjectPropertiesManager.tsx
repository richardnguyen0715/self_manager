"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  useCreateCustomProperty,
  useCustomProperties,
  useDeleteCustomProperty,
  useUpdateCustomProperty,
} from "../hooks";
import {
  DEFAULT_OPTION_COLOR,
  PROPERTY_NAME_MAX,
  PROPERTY_OPTION_COLORS,
  PROPERTY_OPTION_LABEL_MAX,
  PROPERTY_TYPE_LABELS,
  PROPERTY_TYPES,
  isOptionType,
  type CustomProperty,
  type PropertyOption,
  type PropertyType,
} from "../types";

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

/** Option row while editing. `id` is absent for options not yet saved. */
interface EditableOption {
  key: string;
  id?: string;
  label: string;
  color: string | null;
}

let draftSeq = 0;
function newDraftKey(): string {
  draftSeq += 1;
  return `draft-${draftSeq}`;
}

function toEditable(options: PropertyOption[]): EditableOption[] {
  return options.map((o) => ({ key: o.id, id: o.id, label: o.label, color: o.color }));
}

function nextColor(count: number): string {
  return PROPERTY_OPTION_COLORS[count % PROPERTY_OPTION_COLORS.length];
}

/** Add, rename, recolour and remove select options. Controlled by the parent. */
function OptionsEditor({
  options,
  onChange,
  disabled,
}: {
  options: EditableOption[];
  onChange: (next: EditableOption[]) => void;
  disabled?: boolean;
}) {
  const [newLabel, setNewLabel] = useState("");
  const [paletteKey, setPaletteKey] = useState<string | null>(null);

  function addOption() {
    const label = newLabel.trim();
    if (!label) return;
    onChange([
      ...options,
      { key: newDraftKey(), label, color: nextColor(options.length) },
    ]);
    setNewLabel("");
  }

  function update(key: string, patch: Partial<EditableOption>) {
    onChange(options.map((o) => (o.key === key ? { ...o, ...patch } : o)));
  }

  return (
    <div className="space-y-2">
      {options.length === 0 && (
        <p className="text-xs text-muted-foreground">No options yet. Add at least one.</p>
      )}
      <ul className="space-y-1.5">
        {options.map((o) => (
          <li key={o.key} className="space-y-1.5">
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={disabled}
                onClick={() => setPaletteKey(paletteKey === o.key ? null : o.key)}
                className="h-4 w-4 shrink-0 rounded-full ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                style={{ backgroundColor: o.color ?? DEFAULT_OPTION_COLOR }}
                aria-label={`Change colour of ${o.label}`}
                aria-expanded={paletteKey === o.key}
                title="Change colour"
              />
              <input
                value={o.label}
                onChange={(e) => update(o.key, { label: e.target.value })}
                maxLength={PROPERTY_OPTION_LABEL_MAX}
                disabled={disabled}
                aria-label="Option label"
                className="h-8 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  onChange(options.filter((x) => x.key !== o.key));
                  if (paletteKey === o.key) setPaletteKey(null);
                }}
                className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                aria-label={`Remove option ${o.label}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            {paletteKey === o.key && (
              <div className="flex flex-wrap gap-1.5 pl-6" role="radiogroup" aria-label="Option colour">
                {PROPERTY_OPTION_COLORS.map((color) => {
                  const selected = (o.color ?? "").toLowerCase() === color.toLowerCase();
                  return (
                    <button
                      key={color}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      aria-label={color}
                      title={color}
                      onClick={() => {
                        update(o.key, { color });
                        setPaletteKey(null);
                      }}
                      className="h-5 w-5 rounded-full ring-offset-background transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      style={{ backgroundColor: color }}
                    >
                      {selected && <span className="sr-only">Selected</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2 pl-6">
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addOption();
            }
          }}
          maxLength={PROPERTY_OPTION_LABEL_MAX}
          placeholder="Add option..."
          disabled={disabled}
          aria-label="New option label"
          className="h-8 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8"
          onClick={addOption}
          disabled={disabled || !newLabel.trim()}
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </Button>
      </div>
    </div>
  );
}

/** Create form at the top of the manager. The type is chosen here only. */
function CreatePropertyForm({ projectId }: { projectId: string }) {
  const createMut = useCreateCustomProperty();
  const [name, setName] = useState("");
  const [type, setType] = useState<PropertyType>("text");
  const [options, setOptions] = useState<EditableOption[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name is required");
      return;
    }
    if (isOptionType(type) && options.length === 0) {
      setError("Add at least one option");
      return;
    }
    setError(null);
    try {
      await createMut.mutateAsync({
        project_id: projectId,
        name: trimmed,
        type,
        ...(isOptionType(type)
          ? {
              options: options.map((o) => ({ label: o.label.trim(), color: o.color })),
            }
          : {}),
      });
      setName("");
      setType("text");
      setOptions([]);
    } catch (err) {
      setError(errorMessage(err, "Could not create property"));
    }
  }

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !isOptionType(type)) {
              e.preventDefault();
              void handleCreate();
            }
          }}
          placeholder="Property name"
          maxLength={PROPERTY_NAME_MAX}
          aria-label="New property name"
          className="h-9 flex-1 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <select
          value={type}
          onChange={(e) => {
            setType(e.target.value as PropertyType);
            setError(null);
          }}
          aria-label="Property type"
          className="h-9 rounded-md border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {PROPERTY_TYPES.map((t) => (
            <option key={t} value={t}>
              {PROPERTY_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </div>

      {isOptionType(type) && (
        <OptionsEditor options={options} onChange={setOptions} disabled={createMut.isPending} />
      )}

      <div className="flex items-center justify-between gap-3">
        {error ? (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        ) : (
          <span />
        )}
        <Button
          type="button"
          size="sm"
          onClick={() => void handleCreate()}
          disabled={!name.trim() || createMut.isPending}
          className="h-9"
        >
          {createMut.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Add property
        </Button>
      </div>
    </div>
  );
}

function sameOptions(a: PropertyOption[], b: EditableOption[]): boolean {
  if (a.length !== b.length) return false;
  return a.every(
    (o, i) => o.id === b[i].id && o.label === b[i].label && (o.color ?? null) === (b[i].color ?? null),
  );
}

/** One property: rename, edit options, delete. */
function PropertyRow({ property }: { property: CustomProperty }) {
  const updateMut = useUpdateCustomProperty();
  const deleteMut = useDeleteCustomProperty();
  const confirm = useConfirm();

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(property.name);
  // Set by Escape so the blur that follows does not save the rename.
  const renameCancelled = useRef(false);

  const [optionsOpen, setOptionsOpen] = useState(false);
  const [optionsDraft, setOptionsDraft] = useState<EditableOption[]>([]);
  const [error, setError] = useState<string | null>(null);

  const isOption = isOptionType(property.type);
  const busy = updateMut.isPending || deleteMut.isPending;

  function startRename() {
    renameCancelled.current = false;
    setError(null);
    setNameDraft(property.name);
    setEditingName(true);
  }

  async function saveName() {
    if (renameCancelled.current) return;
    const name = nameDraft.trim();
    if (!name || name === property.name) {
      setEditingName(false);
      return;
    }
    setError(null);
    try {
      await updateMut.mutateAsync({ id: property.id, name });
      setEditingName(false);
    } catch (err) {
      setError(errorMessage(err, "Could not rename property"));
    }
  }

  function onRenameKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
    } else if (e.key === "Escape") {
      renameCancelled.current = true;
      setEditingName(false);
    }
  }

  function openOptions() {
    setError(null);
    setOptionsDraft(toEditable(property.options));
    setOptionsOpen(true);
  }

  async function saveOptions() {
    const cleaned = optionsDraft.map((o) => ({
      ...(o.id ? { id: o.id } : {}),
      label: o.label.trim(),
      color: o.color,
    }));
    if (cleaned.length === 0) {
      setError("Keep at least one option");
      return;
    }
    if (cleaned.some((o) => !o.label)) {
      setError("Options need a label");
      return;
    }
    if (sameOptions(property.options, optionsDraft)) {
      setOptionsOpen(false);
      return;
    }

    const removed = property.options.filter(
      (o) => !optionsDraft.some((d) => d.id === o.id),
    );
    if (removed.length > 0) {
      const ok = await confirm({
        title: "Remove options?",
        description:
          "Work items that use a removed option lose that value. This cannot be undone.",
        confirmText: "Remove options",
        destructive: true,
      });
      if (!ok) return;
    }

    setError(null);
    try {
      await updateMut.mutateAsync({ id: property.id, options: cleaned });
      setOptionsOpen(false);
    } catch (err) {
      setError(errorMessage(err, "Could not save options"));
    }
  }

  async function handleDelete() {
    const ok = await confirm({
      title: `Delete property "${property.name}"?`,
      description:
        "Values stored for this property on work items are removed. This cannot be undone.",
      confirmText: "Delete property",
      destructive: true,
    });
    if (!ok) return;
    setError(null);
    try {
      await deleteMut.mutateAsync(property.id);
    } catch (err) {
      setError(errorMessage(err, "Could not delete property"));
    }
  }

  return (
    <li className="px-3 py-2.5">
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {editingName ? (
            <input
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={onRenameKey}
              onBlur={() => void saveName()}
              maxLength={PROPERTY_NAME_MAX}
              aria-label={`Rename ${property.name}`}
              className="h-8 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          ) : (
            <span className="truncate text-sm font-medium">{property.name}</span>
          )}
          {!editingName && (
            <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              {PROPERTY_TYPE_LABELS[property.type]}
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {isOption && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => (optionsOpen ? setOptionsOpen(false) : openOptions())}
              disabled={busy}
            >
              Options ({property.options.length})
            </Button>
          )}
          <button
            type="button"
            onClick={startRename}
            disabled={busy || editingName}
            className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
            aria-label={`Rename ${property.name}`}
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={busy}
            className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
            aria-label={`Delete ${property.name}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {optionsOpen && isOption && (
        <div className="mt-3 space-y-3">
          <OptionsEditor options={optionsDraft} onChange={setOptionsDraft} disabled={busy} />
          <div className="flex items-center justify-end gap-2 pl-6">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => setOptionsOpen(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-8"
              onClick={() => void saveOptions()}
              disabled={busy}
            >
              {updateMut.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Save options
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-1.5 text-xs text-destructive">
          {error}
        </p>
      )}
    </li>
  );
}

/**
 * Project settings section: create, rename, edit options of and delete the
 * custom properties of one project. The type is set at creation and fixed after.
 */
export function ProjectPropertiesManager({ projectId }: { projectId: string }) {
  const { data: properties = [], isLoading, isError } = useCustomProperties(projectId);

  return (
    <div className="space-y-5">
      <CreatePropertyForm projectId={projectId} />

      {isLoading && <p className="text-sm text-muted-foreground">Loading properties...</p>}
      {isError && <p className="text-sm text-destructive">Could not load properties.</p>}
      {!isLoading && !isError && properties.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No properties yet. Add one above to track extra fields on this project&apos;s work items.
        </p>
      )}

      {properties.length > 0 && (
        <ul className="divide-y rounded-lg border">
          {properties.map((p) => (
            <PropertyRow key={p.id} property={p} />
          ))}
        </ul>
      )}
    </div>
  );
}
