"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDuration } from "@/lib/utils";
import type { TimeUsageResponse } from "@/types";

interface TimeUsageChartProps {
  data: TimeUsageResponse | undefined;
  isLoading?: boolean;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}

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
      {Array.from({ length: 7 }, (_, i) => (
        <div
          key={i}
          className="flex-1 rounded-t bg-muted animate-pulse"
          style={{ height: `${30 + Math.random() * 60}%` }}
        />
      ))}
    </div>
  );
}

export function TimeUsageChart({ data, isLoading }: TimeUsageChartProps) {
  const chartData = (data?.days ?? []).map((d) => ({
    date: format(parseISO(d.date), "MMM d"),
    minutes: d.focus_minutes,
  }));

  const totalMinutes = data?.total_focus_minutes ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Focus Time by Day</CardTitle>
        <p className="text-xs text-muted-foreground">
          {totalMinutes > 0
            ? `${formatDuration(totalMinutes)} total focus time`
            : "Focus minutes per day"}
        </p>
      </CardHeader>
      <CardContent className="pl-2">
        {isLoading ? (
          <ChartSkeleton />
        ) : chartData.length === 0 ? (
          <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
            No focus sessions in this period
          </div>
        ) : (
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
                dataKey="date"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                className="text-muted-foreground"
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
              <Bar
                dataKey="minutes"
                name="Focus (min)"
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
