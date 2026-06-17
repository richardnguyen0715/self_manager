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
} from "recharts";
import { format, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DailyStatPoint } from "@/types";

interface ProductivityChartProps {
  data: DailyStatPoint[] | undefined;
  isLoading?: boolean;
}

interface ChartPayloadEntry {
  name: string;
  value: number;
  color: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: ChartPayloadEntry[];
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
          <span className="font-medium text-foreground">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="flex h-[260px] items-end gap-2 px-2">
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

export function ProductivityChart({ data, isLoading }: ProductivityChartProps) {
  const chartData = (data ?? []).map((d) => ({
    date: format(parseISO(d.stat_date), "EEE, MMM d"),
    "Tasks completed": d.tasks_completed,
    "Tasks created": d.tasks_created,
    "Focus (min)": d.focus_minutes,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Productivity Over Time</CardTitle>
        <p className="text-xs text-muted-foreground">
          Daily tasks and focus minutes
        </p>
      </CardHeader>
      <CardContent className="pl-2">
        {isLoading ? (
          <ChartSkeleton />
        ) : chartData.length === 0 ? (
          <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
            No data for this period
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
                className="text-muted-foreground"
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
                iconType="circle"
                iconSize={8}
              />
              <Bar
                dataKey="Tasks completed"
                fill="hsl(var(--primary))"
                radius={[3, 3, 0, 0]}
                maxBarSize={32}
              />
              <Bar
                dataKey="Tasks created"
                fill="hsl(var(--primary) / 0.3)"
                radius={[3, 3, 0, 0]}
                maxBarSize={32}
              />
              <Bar
                dataKey="Focus (min)"
                fill="hsl(var(--chart-2, 197 71% 52%))"
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
