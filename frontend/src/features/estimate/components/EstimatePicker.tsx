"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useEstimateSystem } from "../hooks";
import { formatEstimate } from "../utils";

const NONE = "__none__";

interface EstimatePickerProps {
  /** Estimate system id of the item's project (see useEstimateSystemIdForProject). */
  systemId: string | null | undefined;
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  disabled?: boolean;
  compact?: boolean;
  id?: string;
  className?: string;
}

/**
 * Picks a story-points value from the project's estimate system.
 * The "none" system hides estimates: only a muted note and a clear button
 * (when a value is still stored) are shown.
 */
export function EstimatePicker({
  systemId,
  value,
  onChange,
  disabled,
  compact,
  id,
  className,
}: EstimatePickerProps) {
  const system = useEstimateSystem(systemId);

  if (system?.id === "none") {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <span className="text-xs text-muted-foreground">
          Estimates are disabled for this project.
        </span>
        {value != null && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            disabled={disabled}
            onClick={() => onChange(null)}
          >
            <X className="mr-1 h-3 w-3" />
            Clear
          </Button>
        )}
      </div>
    );
  }

  // Keep a stored value that is outside the scale visible, so it is not silently lost.
  const outOfScale =
    value != null && !(system?.values.some((v) => v.value === value) ?? false);

  return (
    <select
      id={id}
      value={value == null ? NONE : String(value)}
      disabled={disabled}
      onChange={(e) =>
        onChange(e.target.value === NONE ? null : Number(e.target.value))
      }
      className={cn(
        "rounded-md border border-input bg-background px-2 shadow-sm outline-none focus:ring-1 focus:ring-ring disabled:opacity-50",
        compact ? "h-7 text-xs" : "h-9 text-sm",
        className,
      )}
    >
      <option value={NONE}>No estimate</option>
      {system?.values.map((v) => (
        <option key={v.value} value={String(v.value)}>
          {formatEstimate(system, v.value)}
        </option>
      ))}
      {outOfScale && value != null && (
        <option value={String(value)}>{formatEstimate(system, value)}</option>
      )}
    </select>
  );
}
