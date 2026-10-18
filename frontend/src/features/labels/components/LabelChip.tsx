"use client";

import type { CSSProperties } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { DEFAULT_LABEL_COLOR } from "../types";

/**
 * Hex colour to a translucent background, border and text colour, so chips read
 * on both light and dark surfaces without per-theme tokens.
 */
export function labelChipStyle(color: string | undefined): CSSProperties {
  const hex = (
    color && /^#[0-9a-fA-F]{6}$/.test(color) ? color : DEFAULT_LABEL_COLOR
  ).toLowerCase();
  return {
    backgroundColor: `${hex}26`, // ~15% alpha
    color: hex,
    borderColor: `${hex}66`, // ~40% alpha
  };
}

interface LabelChipProps {
  name: string;
  color?: string;
  onRemove?: () => void;
  className?: string;
}

/** Coloured pill for a work-item label. */
export function LabelChip({ name, color, onRemove, className }: LabelChipProps) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium leading-4",
        className,
      )}
      style={labelChipStyle(color)}
      title={name}
    >
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: color ?? DEFAULT_LABEL_COLOR }}
        aria-hidden="true"
      />
      <span className="truncate">{name}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 shrink-0 opacity-70 hover:opacity-100"
          aria-label={`Remove ${name}`}
        >
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </span>
  );
}
