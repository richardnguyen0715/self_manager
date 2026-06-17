"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { format, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CompletionRateResponse } from "@/types";

interface CompletionRateChartProps {
  data: CompletionRateResponse | undefined;
  isLoading?: boolean;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const value = payload[0]?.value ?? 0;
  return (
    <div className="rounded-md border bg-background p-3 shadow-md text-xs">
      <p className="mb-1 font-medium text-foreground">{label}</p>
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-primary inline-block" />
        <span className="text-muted-foreground">Completion rate:</span>
        <span className="font-medium text-foreground">{value.toFixed(1)}%</span>
      </div>
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="h-[220px] w-full bg-muted animate-pulse rounded-md" />
  );
}

export function CompletionRateChart({
  data,
  isLoading,
}: CompletionRateChartProps) {
  // data.daily is DailyCompletionPoint[] with stat_date + completion_rate
  const chartData = (data?.daily ?? []).map((d) => ({
    date: format(parseISO(d.stat_date), "MMM d"),
    rate: d.completion_rate,
  }));

  const overallRate = data?.overall_task_completion_rate ?? null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Completion Rate</CardTitle>
        <p className="text-xs text-muted-foreground">
          {overallRate !== null
            ? `Overall: ${overallRate.toFixed(1)}% — % of planned tasks completed each day`
            : "% of planned tasks completed each day"}
        </p>
      </CardHeader>
      <CardContent className="pl-2">
        {isLoading ? (
          <ChartSkeleton />
        ) : chartData.length === 0 ? (
          <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
            No data for this period
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart
              data={chartData}
              margin={{ top: 4, right: 16, left: -8, bottom: 0 }}
            >
              <defs>
                <linearGradient id="completionGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="hsl(var(--primary))"
                    stopOpacity={0.2}
                  />
                  <stop
                    offset="95%"
                    stopColor="hsl(var(--primary))"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
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
                domain={[0, 100]}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `${v}%`}
                className="text-muted-foreground"
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine
                y={80}
                stroke="hsl(var(--primary))"
                strokeDasharray="4 4"
                strokeOpacity={0.4}
                label={{
                  value: "Target 80%",
                  position: "right",
                  fontSize: 10,
                  fill: "hsl(var(--muted-foreground))",
                }}
              />
              <Area
                type="monotone"
                dataKey="rate"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#completionGradient)"
                dot={{ r: 3, fill: "hsl(var(--primary))" }}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
