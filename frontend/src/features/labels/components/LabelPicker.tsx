"use client";

import { useMemo, useState, type ReactNode } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Check, Plus, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLabels, useCreateLabel } from "../hooks/useLabels";
import { DEFAULT_LABEL_COLOR, LABEL_COLOR_PRESETS, type Label } from "../types";
import { LabelChip } from "./LabelChip";
import { LabelColorSwatches } from "./LabelColorSwatches";

interface LabelPickerProps {
  /** Assigned label names (the work item's `labels` array). */
  value: string[];
  onChange: (next: string[]) => void;
  /** Scope for the label list and for newly created labels. */
  projectId?: string | null;
  /** Custom trigger; defaults to a compact "Add label" button. */
  trigger?: ReactNode;
  className?: string;
}

/**
 * Searchable checkbox popover for assigning labels. Typing a name that matches
 * nothing offers an inline "Create" row with a colour swatch choice.
 */
export function LabelPicker({
  value,
  onChange,
  projectId,
  trigger,
  className,
}: LabelPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [newColor, setNewColor] = useState<string>(LABEL_COLOR_PRESETS[5]);
  const [error, setError] = useState<string | null>(null);

  const { data: labels = [], isLoading } = useLabels(projectId);
  const createLabel = useCreateLabel();

  const colorByName = useMemo(() => {
    const map = new Map<string, string>();
    for (const l of labels) if (!map.has(l.name)) map.set(l.name, l.color);
    return map;
  }, [labels]);

  // Options: managed labels, plus any assigned legacy names that have no row yet.
  const options = useMemo<Label[]>(() => {
    const seen = new Set<string>();
    const rows: Label[] = [];
    for (const l of labels) {
      if (seen.has(l.name)) continue;
      seen.add(l.name);
      rows.push(l);
    }
    for (const name of value) {
      if (seen.has(name)) continue;
      seen.add(name);
      rows.push({
        id: `legacy:${name}`,
        user_id: "",
        project_id: null,
        name,
        color: DEFAULT_LABEL_COLOR,
        created_at: "",
      });
    }
    return rows;
  }, [labels, value]);

  const trimmed = query.trim();
  const lower = trimmed.toLowerCase();
  const filtered = trimmed
    ? options.filter((o) => o.name.toLowerCase().includes(lower))
    : options;
  const exactExists = options.some((o) => o.name.toLowerCase() === lower);
  const canCreate = trimmed.length > 0 && !exactExists;

  function toggle(name: string) {
    onChange(
      value.includes(name) ? value.filter((v) => v !== name) : [...value, name],
    );
  }

  async function create() {
    if (!canCreate || createLabel.isPending) return;
    setError(null);
    try {
      const created = await createLabel.mutateAsync({
        name: trimmed,
        color: newColor,
        project_id: projectId ?? null,
      });
      if (!value.includes(created.name)) onChange([...value, created.name]);
      setQuery("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create label");
    }
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setQuery("");
      setError(null);
    }
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <PopoverPrimitive.Trigger asChild>
        {trigger ?? (
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-1 rounded-full border border-dashed px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors",
              className,
            )}
          >
            <Plus className="h-3 w-3" aria-hidden="true" />
            Add label
          </button>
        )}
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={6}
          className="z-50 w-64 rounded-md border bg-popover text-popover-foreground shadow-md outline-none"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-2 border-b">
            <input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (canCreate) {
                    void create();
                  } else if (filtered.length === 1) {
                    toggle(filtered[0].name);
                  }
                }
              }}
              placeholder="Search or create label..."
              className="w-full bg-transparent px-1 py-0.5 text-sm outline-none placeholder:text-muted-foreground/70"
              aria-label="Search labels"
            />
          </div>

          <div className="max-h-60 overflow-y-auto p-1" role="listbox" aria-multiselectable="true">
            {isLoading && (
              <p className="px-2 py-1.5 text-xs text-muted-foreground">Loading...</p>
            )}
            {!isLoading && filtered.length === 0 && !canCreate && (
              <p className="px-2 py-1.5 text-xs text-muted-foreground">No labels yet.</p>
            )}
            {filtered.map((label) => {
              const checked = value.includes(label.name);
              return (
                <button
                  key={label.id}
                  type="button"
                  role="option"
                  aria-selected={checked}
                  onClick={() => toggle(label.name)}
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                >
                  <span
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border",
                      checked ? "bg-primary border-primary text-primary-foreground" : "border-input",
                    )}
                    aria-hidden="true"
                  >
                    {checked && <Check className="h-3 w-3" />}
                  </span>
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: colorByName.get(label.name) ?? label.color }}
                    aria-hidden="true"
                  />
                  <span className="truncate">{label.name}</span>
                </button>
              );
            })}
          </div>

          {canCreate && (
            <div className="border-t p-2 space-y-2">
              <button
                type="button"
                onClick={() => void create()}
                disabled={createLabel.isPending}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent disabled:opacity-60"
              >
                <Tag className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="truncate">
                  Create <span className="font-medium">&lsquo;{trimmed}&rsquo;</span>
                </span>
              </button>
              <div className="flex items-center gap-2 px-2">
                <span className="text-xs text-muted-foreground">Colour</span>
                <LabelColorSwatches value={newColor} onChange={setNewColor} />
              </div>
              <div className="px-2 pt-1">
                <LabelChip name={trimmed} color={newColor} />
              </div>
            </div>
          )}

          {error && (
            <p role="alert" className="border-t px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          )}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
