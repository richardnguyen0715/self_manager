"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDuration } from "@/lib/utils";
import type { EpicTimePoint, AgileListResponse } from "@/types";

interface TimeByEpicChartProps {
  data: AgileListResponse<EpicTimePoint> | undefined;
  isLoading?: boolean;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; payload: { epic: string } }>;
  label?: string;
}

// Cycling palette that still uses the design system's CSS vars for the first
// slot and falls back to semantic, accessible hues for the rest.
const BAR_COLORS = [
  "hsl(var(--primary))",
  "hsl(197, 71%, 52%)",
  "hsl(142, 71%, 45%)",
  "hsl(38, 92%, 50%)",
  "hsl(280, 65%, 60%)",
  "hsl(0, 72%, 60%)",
];

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const minutes = payload[0]?.value ?? 0;
  return (
    <div className="rounded-md border bg-background p-3 shadow-md text-xs">
      <p className="mb-1 font-medium text-foreground">{label}</p>
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-primary inline-block" />
        <span className="text-muted-foreground">Focus:</span>
        <span className="font-medium text-foreground">
          {formatDuration(minutes)}
        </span>
      </div>
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="flex h-[240px] items-end gap-2 px-2">
      {Array.from({ length: 5 }, (_, i) => (
        <div
          key={i}
          className="flex-1 rounded-t bg-muted animate-pulse"
          style={{ height: `${25 + Math.random() * 65}%` }}
        />
      ))}
    </div>
  );
}

export function TimeByEpicChart({ data, isLoading }: TimeByEpicChartProps) {
  const points = data?.data ?? [];

  // Sort descending by focus time so the busiest epics appear first.
  const sorted = [...points].sort((a, b) => b.focus_minutes - a.focus_minutes);

  const chartData = sorted.map((p) => ({
    epic: p.epic_title,
    minutes: p.focus_minutes,
  }));

  const totalMinutes = sorted.reduce((s, p) => s + p.focus_minutes, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Focus Time by Epic</CardTitle>
        <p className="text-xs text-muted-foreground">
          {totalMinutes > 0
            ? `${formatDuration(totalMinutes)} total across ${sorted.length} epic${sorted.length !== 1 ? "s" : ""}`
            : "Logged focus minutes per epic"}
        </p>
      </CardHeader>
      <CardContent className="pl-2">
        {isLoading ? (
          <ChartSkeleton />
        ) : chartData.length === 0 ? (
          <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
            No epic focus data for this period
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart
                data={chartData}
                margin={{ top: 4, right: 16, left: -8, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-border"
                  vertical={false}
                />
                <XAxis
                  dataKey="epic"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  className="text-muted-foreground"
                  // Truncate long epic names
                  tickFormatter={(v: string) =>
                    v.length > 14 ? `${v.slice(0, 13)}…` : v
                  }
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => `${v}m`}
                  className="text-muted-foreground"
                  allowDecimals={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="minutes" name="Focus (min)" radius={[3, 3, 0, 0]} maxBarSize={40}>
                  {chartData.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={BAR_COLORS[index % BAR_COLORS.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {/* Legend table: epic name + share % */}
            <div className="mt-3 divide-y divide-border rounded-md border overflow-hidden">
              {sorted.map((p, i) => {
                const pct =
                  totalMinutes > 0
                    ? ((p.focus_minutes / totalMinutes) * 100).toFixed(1)
                    : "0.0";
                return (
                  <div
                    key={p.epic_id}
                    className="flex items-center justify-between px-3 py-2 text-xs bg-card hover:bg-muted/40 transition-colors"
                  >
                    <span className="flex items-center gap-2 truncate text-foreground">
                      <span
                        className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                        style={{
                          background: BAR_COLORS[i % BAR_COLORS.length],
                        }}
                      />
                      <span className="truncate">{p.epic_title}</span>
                    </span>
                    <span className="shrink-0 text-muted-foreground ml-4">
                      {formatDuration(p.focus_minutes)}{" "}
                      <span className="opacity-60">({pct}%)</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
