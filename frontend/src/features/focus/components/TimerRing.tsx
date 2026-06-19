"use client";

import { cn } from "@/lib/utils";

interface TimerRingProps {
  /** 0–1 progress (0 = full circle, 1 = empty) */
  progress: number;
  /** pixels — used for SVG math (viewBox) and as the max size on sm+ */
  size?: number;
  strokeWidth?: number;
  /** tailwind color class for the progress arc, e.g. "text-primary" */
  colorClass?: string;
  /** tailwind color class for the track ring */
  trackClass?: string;
  className?: string;
  children?: React.ReactNode;
}

export function TimerRing({
  progress,
  size = 260,
  strokeWidth = 10,
  colorClass = "text-primary",
  trackClass = "text-muted",
  className,
  children,
}: TimerRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  // clamp 0..1
  const clamped = Math.max(0, Math.min(1, progress));
  const dashOffset = circumference * clamped;

  return (
    /*
     * Responsive wrapper:
     *   Mobile  — fills up to 80vw, capped at the prop size in px.
     *   sm+     — fixed pixel size from the prop (inline style).
     * The SVG uses viewBox so it scales naturally inside the wrapper.
     * The absolute centre overlay mirrors the wrapper dimensions.
     */
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{
        width: `min(80vw, ${size}px)`,
        height: `min(80vw, ${size}px)`,
      }}
    >
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width="100%"
        height="100%"
        className="-rotate-90"
        aria-hidden
      >
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className={cn("stroke-current opacity-20", trackClass)}
        />
        {/* Progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          className={cn(
            "stroke-current transition-[stroke-dashoffset] duration-1000 ease-linear",
            colorClass,
          )}
        />
      </svg>
      {/* Centre content — absolutely positioned over the SVG */}
      <div className="absolute inset-0 flex items-center justify-center">
        {children}
      </div>
    </div>
  );
}
