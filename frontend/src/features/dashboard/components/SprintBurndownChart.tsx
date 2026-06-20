"use client";

import { useMemo } from "react";
import { format, parseISO } from "date-fns";
import { TrendingDown, AlertCircle } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { BurndownResponse } from "@/types";

interface SprintBurndownChartProps {
  burndown: BurndownResponse;
}

/**
 * Lightweight inline SVG burndown chart — no chart library dependency.
 * X-axis = sprint days, Y-axis = story points remaining.
 * Two paths: ideal line + actual remaining.
 */
export function SprintBurndownChart({ burndown }: SprintBurndownChartProps) {
  const points = burndown.points ?? [];
  const totalPoints = burndown.total_points ?? 0;

  const { pathActual, pathIdeal, viewBox, xTicks, yTicks } = useMemo(() => {
    if (points.length === 0) {
      return {
        pathActual: "",
        pathIdeal: "",
        viewBox: "0 0 400 160",
        xTicks: [],
        yTicks: [],
      };
    }

    const W = 400;
    const H = 160;
    const PAD_LEFT = 36;
    const PAD_BOTTOM = 24;
    const PAD_TOP = 8;
    const PAD_RIGHT = 8;
    const chartW = W - PAD_LEFT - PAD_RIGHT;
    const chartH = H - PAD_BOTTOM - PAD_TOP;

    const maxY = Math.max(totalPoints, 1);
    const n = points.length;

    function toX(i: number) {
      return PAD_LEFT + (i / Math.max(n - 1, 1)) * chartW;
    }
    function toY(val: number) {
      return PAD_TOP + chartH - (val / maxY) * chartH;
    }

    // Actual path
    const actualCoords = points.map((p, i) => ({
      x: toX(i),
      y: toY(p.remaining_points),
    }));
    const pActual = actualCoords
      .map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`)
      .join(" ");

    // Ideal path
    const idealCoords = points.map((p, i) => ({
      x: toX(i),
      y: toY(p.ideal_points),
    }));
    const pIdeal = idealCoords
      .map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`)
      .join(" ");

    // X axis ticks (show at most 5)
    const tickStep = Math.max(1, Math.floor((n - 1) / 4));
    const xT = [];
    for (let i = 0; i < n; i += tickStep) {
      xT.push({
        x: toX(i),
        label: format(parseISO(points[i].date), "M/d"),
      });
    }
    // ensure last
    if (xT[xT.length - 1]?.label !== format(parseISO(points[n - 1].date), "M/d")) {
      xT.push({
        x: toX(n - 1),
        label: format(parseISO(points[n - 1].date), "M/d"),
      });
    }

    // Y axis ticks (0, half, max)
    const yT = [
      { y: toY(0), label: "0" },
      { y: toY(Math.round(maxY / 2)), label: String(Math.round(maxY / 2)) },
      { y: toY(maxY), label: String(maxY) },
    ];

    return {
      pathActual: pActual,
      pathIdeal: pIdeal,
      viewBox: `0 0 ${W} ${H}`,
      xTicks: xT,
      yTicks: yT,
    };
  }, [points, totalPoints]);

  if (points.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2 pt-5 px-5">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
            Burndown
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <AlertCircle className="h-6 w-6 text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground">No burndown data yet</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Determine if on-track vs behind
  const lastPoint = points[points.length - 1];
  const onTrack =
    lastPoint.remaining_points <= lastPoint.ideal_points + 1;

  return (
    <Card>
      <CardHeader className="pb-2 pt-5 px-5">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
            Burndown
          </CardTitle>
          <span
            className={cn(
              "text-[10px] font-semibold px-1.5 py-0.5 rounded",
              onTrack
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
            )}
          >
            {onTrack ? "On track" : "Behind"}
          </span>
        </div>
        {/* Legend */}
        <div className="flex items-center gap-4 mt-1">
          <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="h-0.5 w-4 rounded-full bg-primary inline-block" />
            Actual
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span
              className="h-0.5 w-4 inline-block"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(to right, hsl(var(--muted-foreground)) 0, hsl(var(--muted-foreground)) 4px, transparent 4px, transparent 8px)",
              }}
            />
            Ideal
          </span>
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-4">
        <svg
          viewBox={viewBox}
          className="w-full h-auto"
          aria-label="Sprint burndown chart"
          role="img"
        >
          {/* Grid lines */}
          {yTicks.map((t, i) => (
            <line
              key={`grid-${i}`}
              x1={36}
              y1={t.y}
              x2={392}
              y2={t.y}
              stroke="currentColor"
              strokeOpacity={0.08}
              strokeWidth={1}
              className="text-foreground"
            />
          ))}

          {/* Y axis labels */}
          {yTicks.map((t, i) => (
            <text
              key={`yl-${i}`}
              x={32}
              y={t.y + 3.5}
              textAnchor="end"
              fontSize={9}
              fill="currentColor"
              className="text-muted-foreground fill-current opacity-60"
            >
              {t.label}
            </text>
          ))}

          {/* X axis labels */}
          {xTicks.map((t, i) => (
            <text
              key={`xl-${i}`}
              x={t.x}
              y={160 - 6}
              textAnchor="middle"
              fontSize={9}
              fill="currentColor"
              className="text-muted-foreground fill-current opacity-60"
            >
              {t.label}
            </text>
          ))}

          {/* Ideal dashed line */}
          <path
            d={pathIdeal}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeDasharray="5,4"
            strokeOpacity={0.4}
            className="text-muted-foreground"
          />

          {/* Actual line */}
          <path
            d={pathActual}
            fill="none"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="stroke-primary"
          />

          {/* Last point dot */}
          {points.length > 0 && (() => {
            const last = points[points.length - 1];
            const n = points.length;
            const W2 = 400; const H2 = 160;
            const PAD_LEFT2 = 36; const PAD_BOTTOM2 = 24; const PAD_TOP2 = 8; const PAD_RIGHT2 = 8;
            const chartW2 = W2 - PAD_LEFT2 - PAD_RIGHT2;
            const chartH2 = H2 - PAD_BOTTOM2 - PAD_TOP2;
            const maxY2 = Math.max(totalPoints, 1);
            const cx = PAD_LEFT2 + ((n - 1) / Math.max(n - 1, 1)) * chartW2;
            const cy = PAD_TOP2 + chartH2 - (last.remaining_points / maxY2) * chartH2;
            return (
              <circle
                cx={cx}
                cy={cy}
                r={3}
                className="fill-primary stroke-background"
                strokeWidth={1.5}
              />
            );
          })()}
        </svg>
      </CardContent>
    </Card>
  );
}
