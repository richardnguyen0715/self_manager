"use client";

import React, { useState, useRef, useCallback } from "react";
import type { DatabaseColumnType, SelectOption } from "@/types";
import { cn } from "@/lib/utils";

interface CellRendererProps {
  value: unknown;
  type: DatabaseColumnType;
  options: SelectOption[];
  editing: boolean;
  onChange: (newValue: unknown) => void;
  onBlur: () => void;
  className?: string;
}

/** Renders a cell in read or edit mode based on the column type. */
export function CellRenderer({
  value,
  type,
  options,
  editing,
  onChange,
  onBlur,
  className,
}: CellRendererProps) {
  if (editing) {
    return (
      <CellEditor
        value={value}
        type={type}
        options={options ?? []}
        onChange={onChange}
        onBlur={onBlur}
        className={className}
      />
    );
  }
  return (
    <CellDisplay
      value={value}
      type={type}
      options={options ?? []}
      className={className}
    />
  );
}

// ─── Read-only display ────────────────────────────────────────────────────────

interface DisplayProps {
  value: unknown;
  type: DatabaseColumnType;
  options: SelectOption[];
  className?: string;
}

function CellDisplay({ value, type, options, className }: DisplayProps) {
  const safeOptions = options ?? [];

  if (value === undefined || value === null || value === "") {
    return <span className={cn("text-muted-foreground/40 italic text-xs", className)}>—</span>;
  }

  switch (type) {
    case "checkbox":
      return (
        <span className={cn("flex items-center", className)}>
          <span
            className={cn(
              "inline-block w-4 h-4 rounded border",
              value
                ? "bg-primary border-primary text-primary-foreground"
                : "border-input",
            )}
          >
            {value ? (
              <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
                <path
                  d="M3 8l3.5 3.5 6.5-7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : null}
          </span>
        </span>
      );

    case "select":
    case "status": {
      const opt = safeOptions.find((o) => o.id === value);
      if (!opt) return <span className={cn("text-xs text-muted-foreground", className)}>{String(value)}</span>;
      return (
        <span
          className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white", className)}
          style={{ backgroundColor: opt.color || "#6B7280" }}
        >
          {opt.name}
        </span>
      );
    }

    case "multi_select": {
      const ids = Array.isArray(value) ? (value as string[]) : [];
      if (ids.length === 0) return <span className={cn("text-muted-foreground/40 italic text-xs", className)}>—</span>;
      return (
        <span className={cn("flex flex-wrap gap-1", className)}>
          {ids.map((id) => {
            const opt = safeOptions.find((o) => o.id === id);
            return opt ? (
              <span
                key={id}
                className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium text-white"
                style={{ backgroundColor: opt.color || "#6B7280" }}
              >
                {opt.name}
              </span>
            ) : null;
          })}
        </span>
      );
    }

    case "date": {
      const d = new Date(String(value));
      return (
        <span className={cn("text-sm", className)}>
          {isNaN(d.getTime()) ? String(value) : d.toLocaleDateString()}
        </span>
      );
    }

    case "url":
      return (
        <a
          href={String(value)}
          target="_blank"
          rel="noopener noreferrer"
          className={cn("text-sm text-primary underline truncate max-w-full block", className)}
          onClick={(e) => e.stopPropagation()}
        >
          {String(value)}
        </a>
      );

    default:
      return <span className={cn("text-sm truncate", className)}>{String(value)}</span>;
  }
}

// ─── Edit mode ────────────────────────────────────────────────────────────────

interface EditorProps {
  value: unknown;
  type: DatabaseColumnType;
  options: SelectOption[];
  onChange: (v: unknown) => void;
  onBlur: () => void;
  className?: string;
}

function CellEditor({ value, type, options, onChange, onBlur, className }: EditorProps) {
  const safeOptions = options ?? [];

  switch (type) {
    case "text":
      return (
        <TextCellEditor
          value={value as string}
          onChange={onChange}
          onBlur={onBlur}
          className={className}
        />
      );

    case "number":
      return (
        <input
          type="number"
          autoFocus
          className={cn(
            "w-full h-full bg-background border-0 outline-none focus:ring-1 focus:ring-ring rounded px-2 py-1 text-sm",
            className,
          )}
          defaultValue={value !== undefined && value !== null ? Number(value) : ""}
          onBlur={(e) => {
            const n = parseFloat(e.target.value);
            onChange(isNaN(n) ? null : n);
            onBlur();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === "Escape") onBlur();
          }}
        />
      );

    case "date":
      return (
        <input
          type="date"
          autoFocus
          className={cn(
            "w-full h-full bg-background border-0 outline-none focus:ring-1 focus:ring-ring rounded px-2 py-1 text-sm",
            className,
          )}
          defaultValue={
            value ? String(value).slice(0, 10) : ""
          }
          onBlur={(e) => {
            onChange(e.target.value || null);
            onBlur();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === "Escape") onBlur();
          }}
        />
      );

    case "checkbox":
      return (
        <span className={cn("flex items-center justify-center cursor-pointer", className)}>
          <input
            type="checkbox"
            autoFocus
            className="w-4 h-4 rounded accent-primary cursor-pointer"
            defaultChecked={Boolean(value)}
            onChange={(e) => {
              onChange(e.target.checked);
            }}
            onBlur={onBlur}
          />
        </span>
      );

    case "select":
    case "status":
      return (
        <SelectCellEditor
          value={value as string | null}
          options={safeOptions}
          onChange={(v) => { onChange(v); onBlur(); }}
          onBlur={onBlur}
          className={className}
        />
      );

    case "multi_select":
      return (
        <MultiSelectCellEditor
          value={Array.isArray(value) ? (value as string[]) : []}
          options={safeOptions}
          onChange={onChange}
          onBlur={onBlur}
          className={className}
        />
      );

    case "url":
      return (
        <input
          type="url"
          autoFocus
          placeholder="https://"
          className={cn(
            "w-full h-full bg-background border-0 outline-none focus:ring-1 focus:ring-ring rounded px-2 py-1 text-sm",
            className,
          )}
          defaultValue={value ? String(value) : ""}
          onBlur={(e) => {
            onChange(e.target.value || null);
            onBlur();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === "Escape") onBlur();
          }}
        />
      );

    default:
      return (
        <TextCellEditor
          value={value as string}
          onChange={onChange}
          onBlur={onBlur}
          className={className}
        />
      );
  }
}

// ─── Sub-editors ──────────────────────────────────────────────────────────────

function TextCellEditor({
  value,
  onChange,
  onBlur,
  className,
}: {
  value: string;
  onChange: (v: unknown) => void;
  onBlur: () => void;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <input
      ref={ref}
      autoFocus
      type="text"
      className={cn(
        "w-full h-full bg-background border-0 outline-none focus:ring-1 focus:ring-ring rounded px-2 py-1 text-sm",
        className,
      )}
      defaultValue={value ? String(value) : ""}
      onBlur={(e) => {
        onChange(e.target.value || null);
        onBlur();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === "Escape") {
          if (ref.current) onChange(ref.current.value || null);
          onBlur();
        }
      }}
    />
  );
}

function SelectCellEditor({
  value,
  options,
  onChange,
  onBlur,
  className,
}: {
  value: string | null;
  options: SelectOption[];
  onChange: (v: string | null) => void;
  onBlur: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "absolute z-50 bg-popover border border-border rounded-md shadow-md py-1 min-w-[160px]",
        className,
      )}
      style={{ top: "100%", left: 0 }}
    >
      <button
        className="w-full text-left px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent"
        onMouseDown={(e) => {
          e.preventDefault();
          onChange(null);
        }}
      >
        Clear
      </button>
      {(options ?? []).map((opt) => (
        <button
          key={opt.id}
          className={cn(
            "w-full text-left px-3 py-1.5 text-sm hover:bg-accent flex items-center gap-2",
            value === opt.id && "bg-accent/50",
          )}
          onMouseDown={(e) => {
            e.preventDefault();
            onChange(opt.id);
          }}
        >
          <span
            className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: opt.color }}
          />
          {opt.name}
        </button>
      ))}
    </div>
  );
}

function MultiSelectCellEditor({
  value,
  options,
  onChange,
  onBlur,
  className,
}: {
  value: string[];
  options: SelectOption[];
  onChange: (v: unknown) => void;
  onBlur: () => void;
  className?: string;
}) {
  const [selected, setSelected] = useState<string[]>(value ?? []);

  const toggle = useCallback(
    (id: string) => {
      setSelected((prev) => {
        const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
        onChange(next);
        return next;
      });
    },
    [onChange],
  );

  return (
    <div
      className={cn(
        "absolute z-50 bg-popover border border-border rounded-md shadow-md py-1 min-w-[160px]",
        className,
      )}
      style={{ top: "100%", left: 0 }}
      onBlur={onBlur}
    >
      {(options ?? []).map((opt) => (
        <button
          key={opt.id}
          className={cn(
            "w-full text-left px-3 py-1.5 text-sm hover:bg-accent flex items-center gap-2",
            selected.includes(opt.id) && "bg-accent/50",
          )}
          onMouseDown={(e) => {
            e.preventDefault();
            toggle(opt.id);
          }}
        >
          <span
            className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: opt.color }}
          />
          {opt.name}
          {selected.includes(opt.id) && (
            <svg
              className="ml-auto w-3.5 h-3.5 text-primary"
              viewBox="0 0 16 16"
              fill="none"
            >
              <path
                d="M3 8l3.5 3.5 6.5-7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>
      ))}
      <div className="border-t border-border mt-1 pt-1 px-2">
        <button
          className="w-full text-xs text-muted-foreground hover:text-foreground py-1"
          onMouseDown={(e) => {
            e.preventDefault();
            onBlur();
          }}
        >
          Done
        </button>
      </div>
    </div>
  );
}
