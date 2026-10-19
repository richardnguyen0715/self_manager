"use client";

import type { CSSProperties } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DEFAULT_OPTION_COLOR,
  type CustomProperty,
  type PropertyValue,
} from "../types";

/** Hex colour to a translucent chip background, border and text colour. */
export function optionChipStyle(color: string | null | undefined): CSSProperties {
  const hex = (
    color && /^#[0-9a-fA-F]{6}$/.test(color) ? color : DEFAULT_OPTION_COLOR
  ).toLowerCase();
  return {
    backgroundColor: `${hex}26`,
    color: hex,
    borderColor: `${hex}66`,
  };
}

function formatDate(value: string): string {
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return value;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface PropertyValueChipProps {
  property: CustomProperty;
  value: PropertyValue | undefined;
  className?: string;
}

/**
 * Read-only rendering of a property value, for list rows and summaries.
 * Renders nothing when the value is empty.
 */
export function PropertyValueChip({ property, value, className }: PropertyValueChipProps) {
  if (value === null || value === undefined || value === "") return null;

  if (property.type === "select" || property.type === "multi_select") {
    const ids = Array.isArray(value) ? value : [String(value)];
    const chips = ids
      .map((id) => property.options.find((o) => o.id === id))
      .filter((o): o is NonNullable<typeof o> => !!o);
    if (chips.length === 0) return null;
    return (
      <span className={cn("inline-flex max-w-full flex-wrap gap-1", className)}>
        {chips.map((o) => (
          <span
            key={o.id}
            className="inline-flex max-w-full items-center rounded-full border px-2 py-0.5 text-xs font-medium leading-4"
            style={optionChipStyle(o.color)}
            title={`${property.name}: ${o.label}`}
          >
            <span className="truncate">{o.label}</span>
          </span>
        ))}
      </span>
    );
  }

  if (property.type === "checkbox") {
    if (value !== true) return null;
    return (
      <span className={cn("inline-flex items-center gap-1 text-xs", className)} title={property.name}>
        <Check className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
        <span className="sr-only">{property.name}: yes</span>
      </span>
    );
  }

  let text: string;
  if (property.type === "date" && typeof value === "string") {
    text = formatDate(value);
  } else {
    text = String(value);
  }

  return (
    <span
      className={cn("truncate text-xs text-foreground", className)}
      title={`${property.name}: ${text}`}
    >
      {text}
    </span>
  );
}
