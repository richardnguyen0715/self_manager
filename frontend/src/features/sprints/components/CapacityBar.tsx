"use client";

import { cn } from "@/lib/utils";

interface CapacityBarProps {
  planned: number;
  capacity: number;
  className?: string;
}

/** Horizontal progress bar showing planned vs capacity points.
 *  Turns amber at ≥80%, red if planned > capacity (overflow guard
 *  is enforced by backend 409, but we still show visually).
 */
export function CapacityBar({ planned, capacity, className }: CapacityBarProps) {
  const hasCapacity = capacity > 0;
  const pct = hasCapacity ? Math.min((planned / capacity) * 100, 100) : 0;
  const overflow = hasCapacity && planned > capacity;
  const warning = hasCapacity && pct >= 80 && !overflow;

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Capacity</span>
        <span className={cn("tabular-nums font-medium", overflow && "text-destructive", warning && "text-amber-600 dark:text-amber-400")}>
          {planned}
          {hasCapacity ? `/${capacity} pts` : " pts"}
        </span>
      </div>
      {hasCapacity && (
        <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              overflow
                ? "bg-destructive"
                : warning
                  ? "bg-amber-500"
                  : "bg-primary",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}
