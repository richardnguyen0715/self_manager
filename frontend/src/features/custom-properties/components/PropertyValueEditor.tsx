"use client";

import { useEffect, useState, type KeyboardEvent } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Check, ChevronDown, ExternalLink, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSetPropertyValue } from "../hooks";
import {
  DEFAULT_OPTION_COLOR,
  PROPERTY_TEXT_MAX,
  type CustomProperty,
  type PropertyOption,
  type PropertyValue,
} from "../types";
import { optionChipStyle } from "./PropertyValueChip";

const INPUT_CLASS =
  "h-8 w-full min-w-0 rounded-md border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60";

function errorMessage(err: unknown): string {
  return err instanceof Error && err.message ? err.message : "Could not save value";
}

interface PropertyValueEditorProps {
  workItemId: string;
  property: CustomProperty;
  /** Current value; undefined and null both mean "empty". */
  value: PropertyValue | undefined;
  className?: string;
}

/**
 * Editor for one property on one work item. Each type has its own input.
 * Text-like inputs save on blur, discrete inputs (date, checkbox, select)
 * save on change. Writes are optimistic (see useSetPropertyValue).
 */
export function PropertyValueEditor({
  workItemId,
  property,
  value,
  className,
}: PropertyValueEditorProps) {
  const mutation = useSetPropertyValue(workItemId);

  function save(next: PropertyValue) {
    mutation.mutate({ propertyId: property.id, value: next });
  }

  const current = value === undefined ? null : value;
  const error = mutation.isError ? errorMessage(mutation.error) : null;

  let control: React.ReactNode;
  switch (property.type) {
    case "text":
    case "url":
    case "number":
      control = (
        <TextualEditor
          key={property.id}
          property={property}
          value={current}
          onSave={save}
        />
      );
      break;
    case "date":
      control = (
        <input
          type="date"
          value={typeof current === "string" ? current : ""}
          onChange={(e) => save(e.target.value || null)}
          aria-label={property.name}
          className={INPUT_CLASS}
        />
      );
      break;
    case "checkbox":
      control = (
        <button
          type="button"
          role="checkbox"
          aria-checked={current === true}
          aria-label={property.name}
          onClick={() => save(current !== true)}
          className={cn(
            "flex h-5 w-5 items-center justify-center rounded border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            current === true
              ? "border-primary bg-primary text-primary-foreground"
              : "border-input hover:border-foreground/40",
          )}
        >
          {current === true && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
        </button>
      );
      break;
    case "select":
      control = (
        <SelectEditor
          property={property}
          value={typeof current === "string" ? current : null}
          onSave={save}
        />
      );
      break;
    case "multi_select":
      control = (
        <MultiSelectEditor
          property={property}
          value={Array.isArray(current) ? current : []}
          onSave={save}
        />
      );
      break;
  }

  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex items-center gap-1.5">
        <div className="min-w-0 flex-1">{control}</div>
        {property.type === "url" && typeof current === "string" && current && (
          <a
            href={current}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-muted-foreground hover:text-foreground"
            aria-label={`Open ${property.name}`}
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-1 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

// ─── Text, URL, number ────────────────────────────────────────────────────────

function TextualEditor({
  property,
  value,
  onSave,
}: {
  property: CustomProperty;
  value: PropertyValue;
  onSave: (next: PropertyValue) => void;
}) {
  const initial = value === null ? "" : String(value);
  const [draft, setDraft] = useState(initial);
  const [localError, setLocalError] = useState<string | null>(null);

  // Keep the draft in step with server state when it changes from outside.
  useEffect(() => {
    setDraft(initial);
    setLocalError(null);
  }, [initial]);

  function commit() {
    const trimmed = draft.trim();
    if (property.type === "number") {
      if (trimmed === "") {
        if (value !== null) onSave(null);
        return;
      }
      const n = Number(trimmed);
      if (!Number.isFinite(n)) {
        setLocalError("Enter a valid number");
        return;
      }
      if (n !== value) onSave(n);
      return;
    }

    if (property.type === "url" && trimmed !== "") {
      if (!/^https?:\/\/\S+$/i.test(trimmed) || trimmed.length > PROPERTY_TEXT_MAX) {
        setLocalError("URL must start with http:// or https://");
        return;
      }
    }
    if (trimmed === "") {
      if (value !== null) onSave(null);
      return;
    }
    if (trimmed !== value) onSave(trimmed);
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
    } else if (e.key === "Escape") {
      setDraft(initial);
      setLocalError(null);
      e.currentTarget.blur();
    }
  }

  return (
    <>
      <input
        type={property.type === "number" ? "text" : property.type === "url" ? "url" : "text"}
        inputMode={property.type === "number" ? "decimal" : undefined}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          setLocalError(null);
        }}
        onBlur={commit}
        onKeyDown={onKey}
        maxLength={property.type === "text" ? PROPERTY_TEXT_MAX : undefined}
        placeholder="Empty"
        aria-label={property.name}
        aria-invalid={localError ? true : undefined}
        className={INPUT_CLASS}
      />
      {localError && (
        <p role="alert" className="mt-1 text-xs text-destructive">
          {localError}
        </p>
      )}
    </>
  );
}

// ─── Select, multi-select ─────────────────────────────────────────────────────

function OptionDot({ option }: { option: PropertyOption }) {
  return (
    <span
      className="h-2 w-2 shrink-0 rounded-full"
      style={{ backgroundColor: option.color ?? DEFAULT_OPTION_COLOR }}
      aria-hidden="true"
    />
  );
}

function SelectEditor({
  property,
  value,
  onSave,
}: {
  property: CustomProperty;
  value: string | null;
  onSave: (next: PropertyValue) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = property.options.find((o) => o.id === value) ?? null;

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          aria-label={property.name}
          className="flex h-8 w-full min-w-0 items-center justify-between gap-2 rounded-md px-2 text-left text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {selected ? (
            <span
              className="inline-flex max-w-full items-center rounded-full border px-2 py-0.5 text-xs font-medium leading-4"
              style={optionChipStyle(selected.color)}
            >
              <span className="truncate">{selected.label}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">Empty</span>
          )}
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={6}
          className="z-50 w-56 rounded-md border bg-popover p-1 text-popover-foreground shadow-md outline-none"
          onClick={(e) => e.stopPropagation()}
        >
          <div role="listbox" aria-label={property.name}>
            <button
              type="button"
              role="option"
              aria-selected={value === null}
              onClick={() => {
                setOpen(false);
                if (value !== null) onSave(null);
              }}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-accent"
            >
              <X className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              No value
            </button>
            {property.options.map((o) => (
              <button
                key={o.id}
                type="button"
                role="option"
                aria-selected={o.id === value}
                onClick={() => {
                  setOpen(false);
                  if (o.id !== value) onSave(o.id);
                }}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
              >
                <OptionDot option={o} />
                <span className="flex-1 truncate">{o.label}</span>
                {o.id === value && <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
              </button>
            ))}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

function MultiSelectEditor({
  property,
  value,
  onSave,
}: {
  property: CustomProperty;
  value: string[];
  onSave: (next: PropertyValue) => void;
}) {
  const [open, setOpen] = useState(false);
  const chosen = property.options.filter((o) => value.includes(o.id));

  function toggle(id: string) {
    const next = value.includes(id)
      ? value.filter((v) => v !== id)
      : [...value, id];
    onSave(next.length > 0 ? next : null);
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          aria-label={property.name}
          className="flex min-h-8 w-full min-w-0 flex-wrap items-center gap-1 rounded-md px-2 py-1 text-left text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {chosen.length === 0 ? (
            <span className="text-muted-foreground">Empty</span>
          ) : (
            chosen.map((o) => (
              <span
                key={o.id}
                className="inline-flex max-w-full items-center rounded-full border px-2 py-0.5 text-xs font-medium leading-4"
                style={optionChipStyle(o.color)}
              >
                <span className="truncate">{o.label}</span>
              </span>
            ))
          )}
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={6}
          className="z-50 w-56 rounded-md border bg-popover p-1 text-popover-foreground shadow-md outline-none"
          onClick={(e) => e.stopPropagation()}
        >
          <div role="listbox" aria-multiselectable="true" aria-label={property.name}>
            {property.options.map((o) => {
              const checked = value.includes(o.id);
              return (
                <button
                  key={o.id}
                  type="button"
                  role="option"
                  aria-selected={checked}
                  onClick={() => toggle(o.id)}
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
                >
                  <span
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border",
                      checked ? "border-primary bg-primary text-primary-foreground" : "border-input",
                    )}
                    aria-hidden="true"
                  >
                    {checked && <Check className="h-3 w-3" />}
                  </span>
                  <OptionDot option={o} />
                  <span className="flex-1 truncate">{o.label}</span>
                </button>
              );
            })}
            {property.options.length === 0 && (
              <p className="px-2 py-1.5 text-xs text-muted-foreground">No options yet.</p>
            )}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
