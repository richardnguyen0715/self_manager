"use client";

import { Loader2, AlertCircle, BarChart2 } from "lucide-react";
import { format } from "date-fns";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useSprintBurndownData } from "../hooks/useSprints";

interface BurndownChartProps {
  sprintId: string;
}

export function BurndownChart({ sprintId }: BurndownChartProps) {
  const { data, isLoading, isError } = useSprintBurndownData(sprintId);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 text-muted-foreground">
        <AlertCircle className="h-6 w-6" />
        <p className="text-sm">Burndown data unavailable.</p>
      </div>
    );
  }

  const points = data.points ?? [];

  if (points.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 text-muted-foreground">
        <BarChart2 className="h-8 w-8 opacity-30" />
        <p className="text-sm">No burndown data yet.</p>
        <p className="text-xs opacity-60">Data appears as work items are completed.</p>
      </div>
    );
  }

  const chartData = points.map((p) => ({
    date: format(new Date(p.date), "MMM d"),
    Remaining: p.remaining_points,
    Ideal: p.ideal_points,
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Burndown</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {format(new Date(data.start_date), "MMM d")} –{" "}
            {format(new Date(data.end_date), "MMM d, yyyy")} ·{" "}
            {data.total_points} total pts
          </p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <LineChart
          data={chartData}
          margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            className="fill-muted-foreground"
          />
          <YAxis
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            className="fill-muted-foreground"
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              borderRadius: "0.5rem",
              border: "1px solid hsl(var(--border))",
              background: "hsl(var(--popover))",
              color: "hsl(var(--popover-foreground))",
              fontSize: 12,
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
          />
          <Line
            type="monotone"
            dataKey="Ideal"
            stroke="hsl(var(--muted-foreground))"
            strokeDasharray="4 4"
            strokeWidth={1.5}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="Remaining"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={{ r: 3, fill: "hsl(var(--primary))" }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
