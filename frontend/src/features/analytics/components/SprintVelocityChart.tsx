"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { VelocityPoint, AgileListResponse } from "@/types";

interface SprintVelocityChartProps {
  data: AgileListResponse<VelocityPoint> | undefined;
  isLoading?: boolean;
}

interface TooltipEntry {
  name: string;
  value: number;
  color: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-background p-3 shadow-md text-xs">
      <p className="mb-1.5 font-medium text-foreground">{label}</p>
      {payload.map((entry) => (
        <div
          key={entry.name}
          className="flex items-center justify-between gap-4"
        >
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: entry.color }}
            />
            {entry.name}
          </span>
          <span className="font-medium text-foreground">{entry.value} pts</span>
        </div>
      ))}
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="flex h-[260px] items-end gap-3 px-2">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex flex-1 flex-col gap-1">
          <div
            className="rounded-t bg-muted animate-pulse"
            style={{ height: `${30 + Math.random() * 60}%` }}
          />
          <div
            className="rounded-t bg-muted/50 animate-pulse"
            style={{ height: `${20 + Math.random() * 40}%` }}
          />
        </div>
      ))}
    </div>
  );
}

export function SprintVelocityChart({
  data,
  isLoading,
}: SprintVelocityChartProps) {
  const points = data?.data ?? [];

  // Average velocity for a reference line
  const avgVelocity =
    points.length > 0
      ? Math.round(
          points.reduce((sum, p) => sum + p.velocity, 0) / points.length,
        )
      : null;

  const chartData = points.map((p) => ({
    sprint: p.sprint_name,
    "Planned pts": p.planned_points,
    "Completed pts": p.completed_points,
    "Velocity %": Math.round(p.velocity),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Sprint Velocity</CardTitle>
        <p className="text-xs text-muted-foreground">
          {avgVelocity !== null
            ? `Avg velocity: ${avgVelocity}% over last ${points.length} sprints`
            : "Planned vs. completed story points per sprint"}
        </p>
      </CardHeader>
      <CardContent className="pl-2">
        {isLoading ? (
          <ChartSkeleton />
        ) : chartData.length === 0 ? (
          <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
            No completed sprints yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
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
                dataKey="sprint"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                className="text-muted-foreground"
              />
              <YAxis
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                className="text-muted-foreground"
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
                iconType="circle"
                iconSize={8}
              />
              {avgVelocity !== null && (
                <ReferenceLine
                  y={avgVelocity}
                  yAxisId={0}
                  stroke="hsl(var(--muted-foreground))"
                  strokeDasharray="4 4"
                  strokeOpacity={0.5}
                  label={{
                    value: `Avg ${avgVelocity}`,
                    position: "right",
                    fontSize: 10,
                    fill: "hsl(var(--muted-foreground))",
                  }}
                />
              )}
              <Bar
                dataKey="Planned pts"
                fill="hsl(var(--primary) / 0.3)"
                radius={[3, 3, 0, 0]}
                maxBarSize={32}
              />
              <Bar
                dataKey="Completed pts"
                fill="hsl(var(--primary))"
                radius={[3, 3, 0, 0]}
                maxBarSize={32}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
