"use client";

import { cn } from "@/lib/utils";

interface GoalProgressBarProps {
  /** 0-100 */
  value: number;
  className?: string;
  showLabel?: boolean;
  size?: "sm" | "md";
}

export function GoalProgressBar({
  value,
  className,
  showLabel = true,
  size = "md",
}: GoalProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));

  const trackHeight = size === "sm" ? "h-1.5" : "h-2.5";

  let fillColor = "bg-primary";
  if (clamped === 100) fillColor = "bg-green-500";
  else if (clamped >= 75) fillColor = "bg-blue-500";
  else if (clamped >= 40) fillColor = "bg-yellow-500";
  else if (clamped > 0) fillColor = "bg-orange-400";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className={cn(
          "flex-1 rounded-full bg-secondary overflow-hidden",
          trackHeight,
        )}
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${clamped}% complete`}
      >
        <div
          className={cn("h-full rounded-full transition-all duration-500", fillColor)}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs tabular-nums text-muted-foreground w-8 text-right">
          {clamped}%
        </span>
      )}
    </div>
  );
}
