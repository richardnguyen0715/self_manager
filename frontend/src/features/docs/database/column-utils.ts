"use client";

import type { DatabaseColumnType, SelectOption } from "@/types";

// ─── Column type metadata ─────────────────────────────────────────────────────

export interface ColumnTypeMeta {
  label: string;
  icon: string; // lucide icon name used in ColumnTypeIcon
  hasOptions: boolean;
}

export const COLUMN_TYPE_META: Record<DatabaseColumnType, ColumnTypeMeta> = {
  text: { label: "Text", icon: "Type", hasOptions: false },
  number: { label: "Number", icon: "Hash", hasOptions: false },
  date: { label: "Date", icon: "Calendar", hasOptions: false },
  checkbox: { label: "Checkbox", icon: "CheckSquare", hasOptions: false },
  select: { label: "Select", icon: "ChevronDown", hasOptions: true },
  multi_select: { label: "Multi-select", icon: "Tags", hasOptions: true },
  status: { label: "Status", icon: "CircleDot", hasOptions: true },
  url: { label: "URL", icon: "Link", hasOptions: false },
};

export const ALL_COLUMN_TYPES: DatabaseColumnType[] = [
  "text",
  "number",
  "date",
  "checkbox",
  "select",
  "multi_select",
  "status",
  "url",
];

// ─── Default options for status columns ──────────────────────────────────────

export const DEFAULT_STATUS_OPTIONS: SelectOption[] = [
  { id: "not-started", name: "Not started", color: "#9CA3AF" },
  { id: "in-progress", name: "In progress", color: "#3B82F6" },
  { id: "done", name: "Done", color: "#10B981" },
];

// ─── Value formatting helpers ─────────────────────────────────────────────────

/** Format a raw cell value to a display string. */
export function formatCellValue(
  value: unknown,
  type: DatabaseColumnType,
  options: SelectOption[],
): string {
  if (value === undefined || value === null || value === "") return "";

  switch (type) {
    case "text":
    case "url":
      return String(value);

    case "number":
      return String(value);

    case "date": {
      const d = new Date(String(value));
      return isNaN(d.getTime()) ? String(value) : d.toLocaleDateString();
    }

    case "checkbox":
      return value ? "true" : "false";

    case "select":
    case "status": {
      const opt = (options ?? []).find((o) => o.id === value);
      return opt?.name ?? String(value);
    }

    case "multi_select": {
      const ids = Array.isArray(value) ? (value as string[]) : [];
      return ids
        .map((id) => (options ?? []).find((o) => o.id === id)?.name ?? id)
        .join(", ");
    }

    default:
      return String(value);
  }
}

/** Generate a random pastel hex color for new select options. */
export function randomOptionColor(): string {
  const hue = Math.floor(Math.random() * 360);
  return `hsl(${hue} 60% 55%)`;
}

/** Generate a UUID-like id for select options (browser-safe). */
export function newOptionId(): string {
  return crypto.randomUUID();
}
